import type { PlayerData, BalanceResult, Diagnostic, Role } from "@/types";
import { calcTotalScore } from "./score";

const ALL_ROLES: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
const LANE_DIFF_WEIGHT = 0.6;

function getPlayableRoles(p: PlayerData): Role[] {
  return [...new Set([...p.preferredRoles, ...(p.canPlayRoles ?? [])])] as Role[];
}

export function balanceTeams(players: PlayerData[]): BalanceResult {
  if (players.length !== 10) throw new Error("Players must be exactly 10");

  const scored = players.map((p) => ({ ...p, _score: calcTotalScore(p) }));

  // 担当可能なロール:
  //   assignedRole 固定済み → そのロールのみ
  //   希望/できるロールあり → その一覧
  //   両方空 → 全ロール許可
  function effectiveRoles(p: typeof scored[0]): Role[] {
    if (p.assignedRole) return [p.assignedRole];
    const roles = getPlayableRoles(p);
    return roles.length > 0 ? roles : [...ALL_ROLES];
  }

  // 5人チームへの全ロール割り当てをバックトラックで列挙
  // 各プレイヤーに重複なく5つのロールを割り当てる組み合わせを返す
  function findAssignments(team: typeof scored): Role[][] {
    const results: Role[][] = [];
    function bt(index: number, used: Set<Role>, current: Role[]) {
      if (index === 5) { results.push([...current]); return; }
      for (const role of effectiveRoles(team[index])) {
        if (!used.has(role)) {
          used.add(role); current.push(role);
          bt(index + 1, used, current);
          current.pop(); used.delete(role);
        }
      }
    }
    bt(0, new Set(), []);
    return results;
  }

  // C(10,5) = 252 通りの青チーム選択を列挙
  const blueCombinations: number[][] = [];
  function combo(start: number, chosen: number[]) {
    if (chosen.length === 5) { blueCombinations.push([...chosen]); return; }
    for (let i = start; i < 10; i++) {
      chosen.push(i); combo(i + 1, chosen); chosen.pop();
    }
  }
  combo(0, []);

  let bestComposite = Infinity;
  let bestBlue: typeof scored = [];
  let bestRed: typeof scored = [];
  let bestBlueRoles: Role[] = [];
  let bestRedRoles: Role[] = [];

  for (const blueIdx of blueCombinations) {
    const blueSet = new Set(blueIdx);
    const blueTeam = blueIdx.map((i) => scored[i]);
    const redTeam = scored.filter((_, i) => !blueSet.has(i));

    const blueAssignments = findAssignments(blueTeam);
    if (blueAssignments.length === 0) continue;
    const redAssignments = findAssignments(redTeam);
    if (redAssignments.length === 0) continue;

    const bTotal = blueTeam.reduce((s, p) => s + p._score, 0);
    const rTotal = redTeam.reduce((s, p) => s + p._score, 0);
    const teamDiff = Math.abs(bTotal - rTotal);

    for (const bRoles of blueAssignments) {
      for (const rRoles of redAssignments) {
        let laneDiff = 0;
        for (const role of ALL_ROLES) {
          const bi = bRoles.indexOf(role);
          const ri = rRoles.indexOf(role);
          if (bi !== -1 && ri !== -1) {
            laneDiff += Math.abs(blueTeam[bi]._score - redTeam[ri]._score);
          }
        }
        const composite = teamDiff + LANE_DIFF_WEIGHT * laneDiff;
        if (composite < bestComposite) {
          bestComposite = composite;
          bestBlue = blueTeam;
          bestRed = redTeam;
          bestBlueRoles = bRoles;
          bestRedRoles = rRoles;
        }
      }
    }
  }

  if (bestComposite === Infinity) {
    // 各ロールに対してプレイ可能なプレイヤー数・プレイヤー名を集計してボトルネックを特定
    const lines: string[] = [];
    for (const role of ALL_ROLES) {
      const canPlay = scored.filter((p) => effectiveRoles(p).includes(role));
      if (canPlay.length < 2) {
        const names = canPlay.map((p) => p.summonerName).join("、") || "なし";
        lines.push(`${role}（${canPlay.length}人: ${names}）`);
      }
    }
    const detail = lines.length > 0
      ? `\n不足ロール:\n${lines.map((l) => `  • ${l}`).join("\n")}`
      : "";
    throw new Error(
      `チーム分け不可能: 全ロールを両チームに1人ずつ配置できる組み合わせがありません。${detail}\nプレイヤーの希望ロール・できるロールを見直してください。`
    );
  }

  const finalBlue: PlayerData[] = bestBlue.map(({ _score: _, ...p }, i) => ({
    ...p,
    assignedRole: bestBlueRoles[i],
  }));
  const finalRed: PlayerData[] = bestRed.map(({ _score: _, ...p }, i) => ({
    ...p,
    assignedRole: bestRedRoles[i],
  }));

  const bTotal = bestBlue.reduce((s, p) => s + p._score, 0);
  const rTotal = bestRed.reduce((s, p) => s + p._score, 0);

  const laneDiffs: Partial<Record<Role, number>> = {};
  for (const role of ALL_ROLES) {
    const bi = bestBlueRoles.indexOf(role);
    const ri = bestRedRoles.indexOf(role);
    if (bi !== -1 && ri !== -1) {
      laneDiffs[role] = Math.round(Math.abs(bestBlue[bi]._score - bestRed[ri]._score));
    }
  }

  return {
    blueTeam: finalBlue,
    redTeam: finalRed,
    blueScore: Math.round(bTotal),
    redScore: Math.round(rTotal),
    scoreDiff: Math.round(Math.abs(bTotal - rTotal)),
    diagnostics: generateDiagnostics(finalBlue, finalRed, bTotal, rTotal, laneDiffs),
  };
}

function generateDiagnostics(
  blue: PlayerData[],
  red: PlayerData[],
  blueScore: number,
  redScore: number,
  laneDiffs: Partial<Record<Role, number>> = {}
): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const total = blueScore + redScore;
  const diff = Math.abs(blueScore - redScore);
  const diffRatio = total > 0 ? diff / total : 0;

  for (const team of [
    { name: "blue" as const, players: blue },
    { name: "red" as const, players: red },
  ]) {
    const assignedRoles = team.players.map((p) => p.assignedRole).filter(Boolean);
    const missingRoles = ALL_ROLES.filter((r) => !assignedRoles.includes(r));

    if (missingRoles.length === 0) {
      diags.push({ team: team.name, type: "ok", message: "全ロール揃い" });
    } else {
      diags.push({ team: team.name, type: "warn", message: `${missingRoles.join("・")}なし` });
    }

    const avgMood = team.players.reduce((s, p) => s + p.mood, 0) / team.players.length;
    if (avgMood >= 2.0) {
      diags.push({ team: team.name, type: "ok", message: "チーム士気高め" });
    } else if (avgMood < 1.0) {
      diags.push({ team: team.name, type: "warn", message: "チーム士気低め" });
    }

    const avgContrib =
      team.players.reduce((s, p) => s + p.contributionScore.raw, 0) / team.players.length;
    if (avgContrib >= 60) {
      diags.push({ team: team.name, type: "ok", message: "サポート力充実" });
    }
  }

  if (diffRatio <= 0.05) {
    diags.push({ team: "both", type: "ok", message: "バランス良好" });
  } else if (diffRatio > 0.15) {
    diags.push({ team: "both", type: "warn", message: "スコア差大きめ" });
  }

  const LANE_WARN_THRESHOLD = 20;
  for (const role of ALL_ROLES) {
    const d = laneDiffs[role];
    if (d !== undefined && d > LANE_WARN_THRESHOLD) {
      diags.push({ team: "both", type: "warn", message: `${role}レーンの実力差大（${d}pt）` });
    }
  }

  return diags;
}
