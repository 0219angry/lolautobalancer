import type { PlayerData, Tier, Mood, Role } from "@/types";

// ティア基礎値
const TIER_BASE: Record<Tier, number> = {
  IRON: 10,
  BRONZE: 20,
  SILVER: 30,
  GOLD: 40,
  PLATINUM: 50,
  EMERALD: 60,
  DIAMOND: 70,
  MASTER: 85,
  GRANDMASTER: 92,
  CHALLENGER: 100,
};

// 上位ティア判定
const HIGH_TIER: Tier[] = ["MASTER", "GRANDMASTER", "CHALLENGER"];

// ロール別スコアの重み
const WIN_RATE_WEIGHT = 40;
const KDA_WEIGHT = 30;
const CS_WEIGHT = 20;
const RELIABILITY_WEIGHT = 10;

// ロール別スコア計算の正規化係数
const KDA_NORMALIZATION_FACTOR = 5;
const CS_PER_MIN_NORMALIZATION_FACTOR = 10;
const RELIABILITY_GAMES_CAP = 20;

// 総合スコアの重み
const SCORE_WEIGHTS = {
  RANK: 0.4,
  ROLE: 0.35,
  CONTRIBUTION: 0.25,
};

// ランクスコア計算
export function calcRankScore(tier: Tier, rank: string, lp: number): number {
  const base = TIER_BASE[tier];
  const rankBonus: Record<string, number> = { IV: 0, III: 2, II: 4, I: 6 };
  const rankAdj = rankBonus[rank] ?? 0;
  const lpMultiplier = HIGH_TIER.includes(tier) ? 6 : 4;
  const lpBonus = Math.floor((lp / 100) * lpMultiplier);
  return base + rankAdj + lpBonus;
}

// ロール別実力スコア計算
export function calcRoleScore(
  player: PlayerData,
  role: Role | string
): number {
  const stats = player.roleStats[role];
  const rankScore = calcRankScore(player.tier, player.rank, player.lp);

  if (!stats || stats.games < 3) {
    return rankScore * 0.8;
  }

  const winRatePart = stats.winRate * WIN_RATE_WEIGHT;
  const kdaPart = Math.min(stats.avgKDA / KDA_NORMALIZATION_FACTOR, 1) * KDA_WEIGHT;
  const csPart = Math.min(stats.avgCSperMin / CS_PER_MIN_NORMALIZATION_FACTOR, 1) * CS_WEIGHT;
  const reliabilityPart = (Math.log(stats.games + 1) / Math.log(RELIABILITY_GAMES_CAP + 1)) * RELIABILITY_WEIGHT;

  return winRatePart + kdaPart + csPart + reliabilityPart;
}

// ムード補正係数
const MOOD_MULTIPLIER: Record<Mood, number> = {
  0: 0.75,
  1: 1.0,
  2: 1.15,
  3: 1.3,
};

// プレイヤー総合スコア計算
export function calcTotalScore(player: PlayerData): number {
  const rankScore = calcRankScore(player.tier, player.rank, player.lp);

  // effectiveRole 決定: assignedRole > preferredRoles[0]
  const effectiveRole = player.assignedRole ?? player.preferredRoles[0];

  let effectiveRoleScore: number;
  if (effectiveRole) {
    effectiveRoleScore = calcRoleScore(player, effectiveRole);
  } else {
    // ロール指定なし: 全ロール平均でフォールバック
    const roles = Object.keys(player.roleStats);
    if (roles.length === 0) {
      effectiveRoleScore = rankScore * 0.8;
    } else {
      effectiveRoleScore =
        roles.reduce((sum, r) => sum + calcRoleScore(player, r), 0) / roles.length;
    }
  }

  const contribScore = player.contributionScore.raw;
  const moodMult = MOOD_MULTIPLIER[player.mood];

  return (
    (rankScore * SCORE_WEIGHTS.RANK +
      effectiveRoleScore * SCORE_WEIGHTS.ROLE +
      contribScore * SCORE_WEIGHTS.CONTRIBUTION) *
    moodMult
  );
}
