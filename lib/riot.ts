import type { Tier, RoleStats, ContributionScore } from "@/types";

const RIOT_API_KEY = process.env.RIOT_API_KEY;

const ASIA_HOST = "https://asia.api.riotgames.com";
const JP1_HOST = "https://jp1.api.riotgames.com";

// Riot API へのリクエスト（リトライ付き）
async function riotFetch(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY! },
      cache: "no-store",
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000 * Math.pow(2, i)));
      continue;
    }

    return res;
  }
  throw new Error("Riot API rate limit exceeded after retries");
}

// Riot ID → PUUID 取得
export async function getPuuid(gameName: string, tagLine: string): Promise<string> {
  const url = `${ASIA_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const res = await riotFetch(url);
  if (!res.ok) throw new Error(`Account not found: ${res.status}`);
  const data = await res.json();
  return data.puuid as string;
}

// PUUID → サモナー情報取得
export async function getSummonerByPuuid(puuid: string): Promise<{ id: string; name: string }> {
  const url = `${JP1_HOST}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
  const res = await riotFetch(url);
  if (!res.ok) throw new Error(`Summoner not found: ${res.status}`);
  const data = await res.json();
  return { id: data.id as string, name: data.name as string };
}

// サモナーID → ランク情報取得
export async function getRankBySummonerId(
  summonerId: string
): Promise<{ tier: Tier; rank: string; lp: number } | null> {
  const url = `${JP1_HOST}/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`;
  const res = await riotFetch(url);
  if (!res.ok) throw new Error(`League entries not found: ${res.status}`);
  const entries = await res.json();

  // ソロキューのランクを優先
  const soloQueue = (entries as Array<{ queueType: string; tier: Tier; rank: string; leaguePoints: number }>).find(
    (e) => e.queueType === "RANKED_SOLO_5x5"
  );
  if (!soloQueue) return null;

  return {
    tier: soloQueue.tier,
    rank: soloQueue.rank,
    lp: soloQueue.leaguePoints,
  };
}

// PUUID → 直近マッチIDリスト取得
export async function getMatchIds(puuid: string, count = 20): Promise<string[]> {
  const url = `${ASIA_HOST}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}&queue=420`;
  const res = await riotFetch(url);
  if (!res.ok) throw new Error(`Match IDs not found: ${res.status}`);
  return res.json();
}

// マッチID → マッチ詳細取得
export async function getMatchDetail(matchId: string): Promise<MatchDetail> {
  const url = `${ASIA_HOST}/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  const res = await riotFetch(url);
  if (!res.ok) throw new Error(`Match not found: ${res.status}`);
  return res.json();
}

// マッチ履歴からロール別スタッツと貢献度を算出
export async function analyzeMatches(
  puuid: string,
  count = 20
): Promise<{
  roleStats: RoleStats;
  preferredRoles: string[];
  contributionScore: ContributionScore;
}> {
  const matchIds = await getMatchIds(puuid, count);

  // 並列でマッチ詳細を取得（レート制限を考慮して5件ずつバッチ処理）
  const details: MatchDetail[] = [];
  const batchSize = 5;
  for (let i = 0; i < matchIds.length; i += batchSize) {
    const batch = matchIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((id) => getMatchDetail(id)));
    details.push(...batchResults);
    if (i + batchSize < matchIds.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // ロール別集計
  const roleMap: Record<string, { wins: number; games: number; totalKDA: number; totalCS: number; totalCS_minutes: number }> = {};
  let totalVision = 0;
  let totalTFParticip = 0;
  let totalControlWards = 0;
  let contributionGames = 0;

  for (const match of details) {
    const participant = match.info.participants.find((p) => p.puuid === puuid);
    if (!participant) continue;

    const role = normalizeRole(participant.teamPosition);
    if (!role) continue;

    if (!roleMap[role]) {
      roleMap[role] = { wins: 0, games: 0, totalKDA: 0, totalCS: 0, totalCS_minutes: 0 };
    }

    const gameDurationMin = match.info.gameDuration / 60;
    const kda =
      participant.deaths === 0
        ? participant.kills + participant.assists
        : (participant.kills + participant.assists) / participant.deaths;

    roleMap[role].games++;
    if (participant.win) roleMap[role].wins++;
    roleMap[role].totalKDA += kda;
    roleMap[role].totalCS += participant.totalMinionsKilled + participant.neutralMinionsKilled;
    roleMap[role].totalCS_minutes += gameDurationMin;

    // 貢献度指標
    const teamKills = match.info.participants
      .filter((p) => p.teamId === participant.teamId)
      .reduce((sum, p) => sum + p.kills, 0);
    const tfParticip = teamKills > 0 ? (participant.kills + participant.assists) / teamKills : 0;

    totalVision += participant.visionScore;
    totalTFParticip += tfParticip;
    totalControlWards += participant.visionWardsBoughtInGame;
    contributionGames++;
  }

  // RoleStats 構築
  const roleStats: RoleStats = {};
  for (const [role, stats] of Object.entries(roleMap)) {
    roleStats[role] = {
      games: stats.games,
      winRate: stats.wins / stats.games,
      avgKDA: stats.totalKDA / stats.games,
      avgCSperMin: stats.totalCS_minutes > 0 ? stats.totalCS / stats.totalCS_minutes : 0,
    };
  }

  // preferredRoles: 試合数が多い順
  const preferredRoles = Object.entries(roleStats)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 2)
    .map(([role]) => role);

  // 貢献度スコア算出
  const avgVision = contributionGames > 0 ? totalVision / contributionGames : 0;
  const avgTFParticip = contributionGames > 0 ? totalTFParticip / contributionGames : 0;
  const avgControlWards = contributionGames > 0 ? totalControlWards / contributionGames : 0;

  const visionNorm = Math.min(avgVision / 60, 1) * 40;
  const tfParticipNorm = avgTFParticip * 40;
  const cwNorm = Math.min(avgControlWards / 2, 1) * 20;

  const contributionScore: ContributionScore = {
    visionScore: avgVision,
    teamFightParticipation: avgTFParticip,
    controlWardsBought: avgControlWards,
    raw: Math.round(visionNorm + tfParticipNorm + cwNorm),
  };

  return { roleStats, preferredRoles, contributionScore };
}

// teamPosition を Role に正規化
function normalizeRole(position: string): string | null {
  const map: Record<string, string> = {
    TOP: "TOP",
    JUNGLE: "JUNGLE",
    MIDDLE: "MID",
    BOTTOM: "BOT",
    UTILITY: "SUPPORT",
  };
  return map[position] ?? null;
}

// Match v5 の型（必要な部分のみ）
interface MatchDetail {
  info: {
    gameDuration: number;
    participants: Array<{
      puuid: string;
      teamId: number;
      teamPosition: string;
      win: boolean;
      kills: number;
      deaths: number;
      assists: number;
      totalMinionsKilled: number;
      neutralMinionsKilled: number;
      visionScore: number;
      visionWardsBoughtInGame: number;
    }>;
  };
}
