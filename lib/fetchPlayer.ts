import type { PlayerData, Role } from "@/types";

export async function fetchPlayerData(riotId: string, index: number): Promise<PlayerData> {
  const parts = riotId.trim().split("#");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Riot ID は「名前#タグ」形式で入力してください");
  }
  const [name, tag] = parts;

  const sumRes = await fetch(`/api/summoner?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`);
  if (!sumRes.ok) {
    const e = await sumRes.json();
    throw new Error(e.error ?? "サモナー取得失敗");
  }
  const sumData = await sumRes.json();

  const matchRes = await fetch(`/api/matches?puuid=${encodeURIComponent(sumData.puuid)}`);
  let roleStats = {};
  let preferredRoles: Role[] = [];
  let contributionScore = { visionScore: 0, teamFightParticipation: 0, controlWardsBought: 0, raw: 50 };

  if (matchRes.ok) {
    const matchData = await matchRes.json();
    roleStats = matchData.roleStats;
    preferredRoles = matchData.preferredRoles as Role[];
    contributionScore = matchData.contributionScore;
  }

  return {
    id: `player-${index}`,
    riotId: riotId.trim(),
    puuid: sumData.puuid,
    summonerName: sumData.summonerName,
    tier: sumData.tier,
    rank: sumData.rank,
    lp: sumData.lp,
    preferredRoles,
    roleStats,
    contributionScore,
    mood: 1,
  };
}
