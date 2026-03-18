import type { PlayerData, BalanceResult, Diagnostic, Role } from "@/types";
import { calcTotalScore } from "./score";

const ALL_ROLES: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];

export function balanceTeams(players: PlayerData[]): BalanceResult {
  if (players.length !== 10) {
    throw new Error("Players must be exactly 10");
  }

  // Step 1: 各プレイヤーのtotalScoreを計算
  const scored = players.map((p) => ({ ...p, _score: calcTotalScore(p) }));

  // Step 2: ロールグループ分け
  // assignedRole > preferredRoles[0] の優先度でロールを決定
  const roleGroups: Record<string, typeof scored> = {};
  for (const role of ALL_ROLES) roleGroups[role] = [];
  const unassigned: typeof scored = [];

  for (const p of scored) {
    const role = p.assignedRole ?? p.preferredRoles[0];
    if (role && ALL_ROLES.includes(role as Role)) {
      roleGroups[role].push(p);
    } else {
      unassigned.push(p);
    }
  }

  // 同ロール希望者が多い場合は第2希望で再分配
  for (const role of ALL_ROLES) {
    while (roleGroups[role].length > 2) {
      // スコアが最も低いプレイヤーを第2希望へ移動
      roleGroups[role].sort((a, b) => a._score - b._score);
      const displaced = roleGroups[role].shift()!;
      const altRole = displaced.preferredRoles[1];
      if (altRole && ALL_ROLES.includes(altRole as Role) && roleGroups[altRole].length < 2) {
        roleGroups[altRole].push(displaced);
      } else {
        unassigned.push(displaced);
      }
    }
  }

  const blueTeam: typeof scored = [];
  const redTeam: typeof scored = [];

  // Step 3: ロールペアリング — 各ロールで上位2名をBlue/Red交互に割り当て
  for (const role of ALL_ROLES) {
    const group = roleGroups[role].sort((a, b) => b._score - a._score);
    if (group.length >= 2) {
      // スコアが高い方を現在合計スコアが低いチームへ（人数ではなくスコアで判定）
      const blueScore = blueTeam.reduce((s, p) => s + p._score, 0);
      const redScore = redTeam.reduce((s, p) => s + p._score, 0);
      if (blueScore <= redScore) {
        blueTeam.push({ ...group[0], assignedRole: role as Role });
        redTeam.push({ ...group[1], assignedRole: role as Role });
      } else {
        redTeam.push({ ...group[0], assignedRole: role as Role });
        blueTeam.push({ ...group[1], assignedRole: role as Role });
      }
    } else if (group.length === 1) {
      unassigned.push(group[0]);
    }
  }

  // Step 4: 残余プレイヤーをスコアの低いチームへ順次追加
  unassigned.sort((a, b) => b._score - a._score);
  for (const p of unassigned) {
    const blueScore = blueTeam.reduce((s, x) => s + x._score, 0);
    const redScore = redTeam.reduce((s, x) => s + x._score, 0);
    const assignedRole = p.assignedRole ?? (p.preferredRoles[0] as Role | undefined);

    if (blueTeam.length < 5 && blueScore <= redScore) {
      blueTeam.push({ ...p, assignedRole });
    } else if (redTeam.length < 5) {
      redTeam.push({ ...p, assignedRole });
    } else {
      blueTeam.push({ ...p, assignedRole });
    }
  }

  // Step 5: 最終調整（assignedRole が設定されていないプレイヤーのみ交換対象）
  // スコア差が 5% 以内に収束するまで繰り返しスワップ
  let blueScore = blueTeam.reduce((s, p) => s + p._score, 0);
  let redScore = redTeam.reduce((s, p) => s + p._score, 0);
  const total = blueScore + redScore;
  const scoreDiffThreshold = total * 0.05; // 5%

  const fixedRolePlayerIds = new Set(players.filter((p) => p.assignedRole).map((p) => p.id));

  let improved = true;
  while (improved && Math.abs(blueScore - redScore) > scoreDiffThreshold) {
    improved = false;
    let bestDiff = Math.abs(blueScore - redScore);
    let bestSwap: [number, number] | null = null;

    for (let bi = 0; bi < blueTeam.length; bi++) {
      for (let ri = 0; ri < redTeam.length; ri++) {
        // assignedRole が設定されたプレイヤーはロール固定のため除外
        if (fixedRolePlayerIds.has(blueTeam[bi].id)) continue;
        if (fixedRolePlayerIds.has(redTeam[ri].id)) continue;
        // スワップ後に相手のロールを担当できるか確認（同一ロールは常にOK）
        const sameRole = blueTeam[bi].assignedRole === redTeam[ri].assignedRole;
        const blueCanPlay = sameRole || blueTeam[bi].preferredRoles.includes(redTeam[ri].assignedRole as Role);
        const redCanPlay = sameRole || redTeam[ri].preferredRoles.includes(blueTeam[bi].assignedRole as Role);
        if (!blueCanPlay || !redCanPlay) continue;

        const newBlue = blueScore - blueTeam[bi]._score + redTeam[ri]._score;
        const newRed = redScore - redTeam[ri]._score + blueTeam[bi]._score;
        const diff = Math.abs(newBlue - newRed);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSwap = [bi, ri];
        }
      }
    }

    if (bestSwap) {
      const [bi, ri] = bestSwap;
      const tmp = blueTeam[bi];
      blueTeam[bi] = redTeam[ri];
      redTeam[ri] = tmp;
      blueScore = blueTeam.reduce((s, p) => s + p._score, 0);
      redScore = redTeam.reduce((s, p) => s + p._score, 0);
      improved = true;
    }
  }

  // Step 6: assignedRole の確定（未設定プレイヤーに effectiveRole を書き込む）
  const finalBlue: PlayerData[] = blueTeam.map(({ _score: _, ...p }) => ({
    ...p,
    assignedRole: p.assignedRole ?? (p.preferredRoles[0] as Role | undefined),
  }));
  const finalRed: PlayerData[] = redTeam.map(({ _score: _, ...p }) => ({
    ...p,
    assignedRole: p.assignedRole ?? (p.preferredRoles[0] as Role | undefined),
  }));

  const diagnostics = generateDiagnostics(finalBlue, finalRed, blueScore, redScore);

  return {
    blueTeam: finalBlue,
    redTeam: finalRed,
    blueScore: Math.round(blueScore),
    redScore: Math.round(redScore),
    scoreDiff: Math.round(Math.abs(blueScore - redScore)),
    diagnostics,
  };
}

function generateDiagnostics(
  blue: PlayerData[],
  red: PlayerData[],
  blueScore: number,
  redScore: number
): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const total = blueScore + redScore;
  const diff = Math.abs(blueScore - redScore);
  const diffRatio = total > 0 ? diff / total : 0;

  // ロール充足チェック
  for (const team of [
    { name: "blue" as const, players: blue },
    { name: "red" as const, players: red },
  ]) {
    const assignedRoles = team.players.map((p) => p.assignedRole).filter(Boolean);
    const missingRoles = ALL_ROLES.filter((r) => !assignedRoles.includes(r));

    if (missingRoles.length === 0) {
      diags.push({ team: team.name, type: "ok", message: "全ロール揃い" });
    } else {
      diags.push({
        team: team.name,
        type: "warn",
        message: `${missingRoles.join("・")}なし`,
      });
    }

    // ムードチェック
    const avgMood = team.players.reduce((s, p) => s + p.mood, 0) / team.players.length;
    if (avgMood >= 2.0) {
      diags.push({ team: team.name, type: "ok", message: "チーム士気高め" });
    } else if (avgMood < 1.0) {
      diags.push({ team: team.name, type: "warn", message: "チーム士気低め" });
    }

    // 貢献度チェック
    const avgContrib =
      team.players.reduce((s, p) => s + p.contributionScore.raw, 0) / team.players.length;
    if (avgContrib >= 60) {
      diags.push({ team: team.name, type: "ok", message: "サポート力充実" });
    }
  }

  // スコアバランスチェック
  if (diffRatio <= 0.05) {
    diags.push({ team: "both", type: "ok", message: "バランス良好" });
  } else if (diffRatio > 0.15) {
    diags.push({ team: "both", type: "warn", message: "スコア差大きめ" });
  }

  return diags;
}
