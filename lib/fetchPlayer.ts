import type { PlayerData, Role, RoleStats, ContributionScore, Tier } from "@/types";
import { getCachedPlayer, setCachedPlayer } from "./playerCache";

function generateAutoTags(
  tier: Tier,
  preferredRoles: Role[],
  roleStats: RoleStats,
  cs: ContributionScore
): string[] {
  const tags: string[] = [];

  // ランク帯
  if (tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER") {
    tags.push("ハイランク");
  }

  // 貢献度系
  if (cs.visionScore > 40) tags.push("ビジョン型");
  if (cs.teamFightParticipation > 0.65) tags.push("集団戦型");
  if (cs.raw >= 70) tags.push("高貢献");

  // 得意ロールのスタッツ
  const prefRole = preferredRoles[0];
  if (prefRole && roleStats[prefRole]) {
    const s = roleStats[prefRole];
    if (s.winRate >= 0.6 && s.games >= 5) tags.push("安定型");
    if (s.avgKDA >= 4) tags.push("高KDA");
    if (s.avgCSperMin >= 7) tags.push("CS型");
  }

  return tags;
}

export async function fetchPlayerData(riotId: string, index: number, skipCache = false): Promise<PlayerData> {
  // キャッシュ確認（1時間以内のデータはAPIを呼ばない）
  if (!skipCache) {
    const cached = getCachedPlayer(riotId);
    if (cached) return { ...cached, id: `player-${index}` };
  }

  const parts = riotId.trim().split("#");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Riot ID は「名前#タグ」形式で入力してください");
  }
  const [name, tag] = parts;

  const sumRes = await fetch(`/api/summoner?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`);
  if (!sumRes.ok) {
    if (sumRes.status === 429) throw new Error("RATE_LIMIT");
    const e = await sumRes.json();
    throw new Error(e.error ?? "サモナー取得失敗");
  }
  const sumData = await sumRes.json();

  let roleStats = {};
  let preferredRoles: Role[] = [];
  let contributionScore = { visionScore: 0, teamFightParticipation: 0, controlWardsBought: 0, raw: 50 };

  try {
    const matchRes = await fetch(
      `/api/matches?puuid=${encodeURIComponent(sumData.puuid)}`,
      { signal: AbortSignal.timeout(45000) } // 20試合取得に対応して延長
    );
    if (matchRes.ok) {
      const matchData = await matchRes.json();
      roleStats = matchData.roleStats;
      preferredRoles = matchData.preferredRoles as Role[];
      contributionScore = matchData.contributionScore;
    }
  } catch {
    // タイムアウト・エラー時はデフォルト値を使用
  }

  const autoTags = generateAutoTags(sumData.tier, preferredRoles, roleStats, contributionScore);

  const data: PlayerData = {
    id: `player-${index}`,
    riotId: riotId.trim(),
    puuid: sumData.puuid,
    summonerName: sumData.summonerName,
    tier: sumData.tier,
    rank: sumData.rank,
    lp: sumData.lp,
    preferredRoles,
    canPlayRoles: [],
    roleStats,
    contributionScore,
    mood: 1,
    autoTags,
  };

  setCachedPlayer(riotId, data);
  return data;
}
