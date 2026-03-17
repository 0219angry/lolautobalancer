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

  const winRatePart = stats.winRate * 40;
  const kdaPart = Math.min(stats.avgKDA / 5, 1) * 30;
  const csPart = Math.min(stats.avgCSperMin / 10, 1) * 20;
  const reliabilityPart = (Math.log(stats.games + 1) / Math.log(21)) * 10;

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

  return (rankScore * 0.4 + effectiveRoleScore * 0.35 + contribScore * 0.25) * moodMult;
}
