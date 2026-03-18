"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BalanceResult, PlayerData, Role } from "@/types";
import { calcRankScore, calcRoleScore, calcTotalScore } from "@/lib/score";
import { useCopyImage } from "@/lib/useCopyImage";
import { useToast } from "@/lib/useToast";
const ALL_ROLES: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
const MOOD_LABELS = ["疲れ気味", "普通", "好調", "絶好調"];
const MOOD_MULT = [0.85, 1.0, 1.08, 1.15];
const ROLE_SHORT: Record<string, string> = {
  TOP: "TOP", JUNGLE: "JGL", MID: "MID", BOT: "BOT", SUPPORT: "SUP",
};
const TIER_COLOR: Record<string, string> = {
  IRON: "text-ink-dim", BRONZE: "text-amber-600", SILVER: "text-ink-dim",
  GOLD: "text-gold", PLATINUM: "text-teal-400", EMERALD: "text-emerald-400",
  DIAMOND: "text-azure", MASTER: "text-purple-400", GRANDMASTER: "text-crimson",
  CHALLENGER: "text-gold-bright",
};

// ロール別重み定義（score.ts と同期）
const ROLE_WEIGHTS: Record<string, { winRate: number; kda: number; cs: number; reliability: number }> = {
  JUNGLE:  { winRate: 40, kda: 35, cs: 15, reliability: 10 },
  SUPPORT: { winRate: 45, kda: 35, cs: 0,  reliability: 20 },
  DEFAULT: { winRate: 40, kda: 30, cs: 20, reliability: 10 },
};
function getRoleWeights(role: string) {
  return ROLE_WEIGHTS[role] ?? ROLE_WEIGHTS.DEFAULT;
}

interface DetailedScores {
  rankScore: number;
  rankBase: number;
  rankBonus: number;
  rankLpBonus: number;
  roleScore: number;
  roleWinRate: number;
  roleKda: number;
  roleCs: number;
  roleReliability: number;
  roleGames: number;
  roleFallback: boolean;
  contribRaw: number;
  contribVision: number;
  contribTeamFight: number;
  contribControlWards: number;
  moodMult: number;
  total: number;
}

function calcDetailed(player: PlayerData): DetailedScores {
  const rankScore = calcRankScore(player.tier, player.rank, player.lp);
  const TIER_BASE: Record<string, number> = {
    IRON: 10, BRONZE: 20, SILVER: 30, GOLD: 40, PLATINUM: 50,
    EMERALD: 60, DIAMOND: 70, MASTER: 85, GRANDMASTER: 92, CHALLENGER: 100,
  };
  const rankBonus: Record<string, number> = { IV: 0, III: 2, II: 4, I: 6 };
  const HIGH_TIER = ["MASTER", "GRANDMASTER", "CHALLENGER"];
  const rankBase = TIER_BASE[player.tier] ?? 0;
  const rankBonusVal = rankBonus[player.rank] ?? 0;
  const lpMultiplier = HIGH_TIER.includes(player.tier) ? 6 : 4;
  const rankLpBonus = Math.floor((player.lp / 100) * lpMultiplier);

  const role = player.assignedRole ?? player.preferredRoles[0];
  const stats = role ? player.roleStats[role] : undefined;
  const roleScore = role ? calcRoleScore(player, role) : rankScore * 0.8;
  const roleFallback = !stats || (stats?.games ?? 0) < 3;

  let roleWinRate = 0, roleKda = 0, roleCs = 0, roleReliability = 0;
  if (!roleFallback && stats && role) {
    const w = getRoleWeights(role);
    const KDA_NORM = 5, CS_NORM = 7, GAMES_CAP = 20;
    roleWinRate = stats.winRate * w.winRate;
    roleKda = Math.min(stats.avgKDA / KDA_NORM, 1) * w.kda;
    roleCs = Math.min(stats.avgCSperMin / CS_NORM, 1) * w.cs;
    roleReliability = (Math.log(stats.games + 1) / Math.log(GAMES_CAP + 1)) * w.reliability;
  }

  const moodMult = MOOD_MULT[player.mood] ?? 1.0;
  const total = calcTotalScore(player);

  return {
    rankScore, rankBase, rankBonus: rankBonusVal, rankLpBonus,
    roleScore, roleWinRate, roleKda, roleCs, roleReliability,
    roleGames: stats?.games ?? 0, roleFallback,
    contribRaw: player.contributionScore.raw,
    contribVision: player.contributionScore.visionScore,
    contribTeamFight: player.contributionScore.teamFightParticipation,
    contribControlWards: player.contributionScore.controlWardsBought,
    moodMult, total,
  };
}

function cmp(a: number, b: number): { a: string; b: string } {
  if (Math.abs(a - b) < 0.5) return { a: "text-ink", b: "text-ink" };
  return a > b
    ? { a: "text-azure font-bold", b: "text-crimson" }
    : { a: "text-crimson", b: "text-azure font-bold" };
}

function Row({ label, bv, rv, fmt = (v: number) => v.toFixed(1), indent = false }: {
  label: string; bv: number; rv: number;
  fmt?: (v: number) => string; indent?: boolean;
}) {
  const { a, b } = cmp(bv, rv);
  return (
    <div className={`flex items-center gap-2 py-0.5 ${indent ? "pl-3 border-l border-wire" : ""}`}>
      <span className={`font-mono text-sm w-24 text-right tabular-nums ${a}`}>{fmt(bv)}</span>
      <span className={`flex-1 font-mono text-xs text-center ${indent ? "text-ink-muted" : "text-ink-dim"}`}>{label}</span>
      <span className={`font-mono text-sm w-24 tabular-nums ${b}`}>{fmt(rv)}</span>
    </div>
  );
}

function ScoreBar({ bv, rv }: { bv: number; rv: number }) {
  const total = bv + rv;
  const bluePct = total > 0 ? (bv / total) * 100 : 50;
  return (
    <div className="flex h-1 my-1">
      <div className="bg-azure transition-all duration-500" style={{ width: `${bluePct}%` }} />
      <div className="bg-crimson transition-all duration-500" style={{ width: `${100 - bluePct}%` }} />
    </div>
  );
}

function LaneMatchup({ blue, red }: { blue: PlayerData; red: PlayerData }) {
  const [open, setOpen] = useState(false);
  const bs = calcDetailed(blue);
  const rs = calcDetailed(red);
  const role = blue.assignedRole ?? blue.preferredRoles[0];
  const blueStats = role ? blue.roleStats[role] : undefined;
  const redStats = role ? red.roleStats[role] : undefined;
  const scoreDiff = Math.abs(bs.total - rs.total);
  const blueRole = role ? blue.roleStats[role] : undefined;
  const redRole = role ? red.roleStats[role] : undefined;

  return (
    <div className="bg-surface border border-wire">
      {/* ロールヘッダー */}
      <div className="px-4 py-2 border-b border-wire flex items-center gap-3 bg-raised">
        <span className="font-mono text-xs text-gold uppercase tracking-widest flex-1">
          {role ? (ROLE_SHORT[role] ?? role) : "—"}
        </span>
        <span className={`font-mono text-xs ${scoreDiff <= 5 ? "text-emerald-400" : scoreDiff <= 15 ? "text-gold" : "text-crimson"}`}>
          差 {scoreDiff.toFixed(1)}pt
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-xs text-ink-muted border border-wire px-2 py-0.5 hover:border-wire-bright hover:text-ink transition-colors"
        >
          {open ? "▲ 詳細" : "▼ 詳細"}
        </button>
      </div>

      {/* プレイヤー名・ランク行 */}
      <div className="grid grid-cols-2 gap-px bg-wire">
        <div className="bg-surface px-4 py-3 border-l-2 border-l-azure">
          <p className="font-semibold text-ink text-sm truncate">{blue.summonerName}</p>
          <p className={`font-mono text-xs ${TIER_COLOR[blue.tier] ?? "text-ink"}`}>
            {blue.tier} {blue.rank} {blue.lp}LP
          </p>
          <p className="font-mono text-xs text-ink-muted mt-0.5">{MOOD_LABELS[blue.mood]}</p>
        </div>
        <div className="bg-surface px-4 py-3 border-l-2 border-l-crimson">
          <p className="font-semibold text-ink text-sm truncate">{red.summonerName}</p>
          <p className={`font-mono text-xs ${TIER_COLOR[red.tier] ?? "text-ink"}`}>
            {red.tier} {red.rank} {red.lp}LP
          </p>
          <p className="font-mono text-xs text-ink-muted mt-0.5">{MOOD_LABELS[red.mood]}</p>
        </div>
      </div>

      {/* スコアサマリー */}
      <div className="px-4 py-3 border-t border-wire">
        <Row label="Total Score" bv={bs.total} rv={rs.total} />
        <ScoreBar bv={bs.total} rv={rs.total} />
      </div>

      {/* 詳細展開 */}
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-wire pt-3">

          {/* ランクスコア */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-ink-muted uppercase tracking-widest">Rank Score</span>
              <span className="font-mono text-xs text-ink-muted">× 0.40</span>
            </div>
            <Row label="Rank Score" bv={bs.rankScore} rv={rs.rankScore} />
            <Row label="ティア基礎値" bv={bs.rankBase} rv={rs.rankBase} indent />
            <Row label="ランクボーナス" bv={bs.rankBonus} rv={rs.rankBonus} indent />
            <Row label="LPボーナス" bv={bs.rankLpBonus} rv={rs.rankLpBonus} indent />
          </div>

          {/* ロールスコア */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-ink-muted uppercase tracking-widest">Role Score</span>
              <span className="font-mono text-xs text-ink-muted">× 0.35</span>
              {role && <span className="font-mono text-xs text-gold">{ROLE_SHORT[role]}</span>}
            </div>
            <Row label="Role Score" bv={bs.roleScore} rv={rs.roleScore} />
            {(bs.roleFallback || rs.roleFallback) && (
              <p className="font-mono text-xs text-ink-muted pl-3 mt-0.5">
                {bs.roleFallback && `Blue: 履歴不足（${bs.roleGames}戦）→ランク×0.8`}
                {bs.roleFallback && rs.roleFallback && " / "}
                {rs.roleFallback && `Red: 履歴不足（${rs.roleGames}戦）→ランク×0.8`}
              </p>
            )}
            {!bs.roleFallback || !rs.roleFallback ? (
              <>
                {role && (() => {
                  const w = getRoleWeights(role);
                  return (
                    <>
                      <Row label={`勝率 (${w.winRate}%重み)`} bv={bs.roleWinRate} rv={rs.roleWinRate} indent
                        fmt={(v) => v.toFixed(1)} />
                      <Row label={`KDA (${w.kda}%重み)`} bv={bs.roleKda} rv={rs.roleKda} indent />
                      {w.cs > 0 && <Row label={`CS/分 (${w.cs}%重み)`} bv={bs.roleCs} rv={rs.roleCs} indent />}
                      <Row label={`試合数 (${w.reliability}%重み)`} bv={bs.roleReliability} rv={rs.roleReliability} indent />
                    </>
                  );
                })()}
                {/* 生スタッツ */}
                {(blueStats || redStats) && (
                  <div className="mt-2 pt-2 border-t border-wire flex flex-col gap-0.5">
                    <p className="font-mono text-xs text-ink-muted mb-1">生スタッツ（{blueStats?.games ?? 0} / {redStats?.games ?? 0} 戦）</p>
                    <Row label="勝率" bv={(blueStats?.winRate ?? 0) * 100} rv={(redStats?.winRate ?? 0) * 100}
                      fmt={(v) => `${v.toFixed(0)}%`} indent />
                    <Row label="KDA" bv={blueStats?.avgKDA ?? 0} rv={redStats?.avgKDA ?? 0} indent />
                    <Row label="CS/分" bv={blueStats?.avgCSperMin ?? 0} rv={redStats?.avgCSperMin ?? 0} indent />
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* 貢献スコア */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-ink-muted uppercase tracking-widest">Contrib Score</span>
              <span className="font-mono text-xs text-ink-muted">× 0.25</span>
            </div>
            <Row label="貢献スコア (raw)" bv={bs.contribRaw} rv={rs.contribRaw} />
            <Row label="ビジョンスコア" bv={bs.contribVision} rv={rs.contribVision} indent />
            <Row label="集団戦参加率" bv={bs.contribTeamFight * 100} rv={rs.contribTeamFight * 100}
              fmt={(v) => `${v.toFixed(0)}%`} indent />
            <Row label="コントロールWD" bv={bs.contribControlWards} rv={rs.contribControlWards} indent />
          </div>

          {/* ムード補正 */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-ink-muted uppercase tracking-widest">Mood Multiplier</span>
            </div>
            <Row label="ムード補正" bv={bs.moodMult} rv={rs.moodMult}
              fmt={(v) => `×${v.toFixed(2)}`} />
          </div>

          {/* 計算式サマリー */}
          <div className="border-t border-wire pt-3">
            <p className="font-mono text-xs text-ink-muted mb-2">計算式</p>
            {[{ label: "Blue", s: bs, color: "text-azure" }, { label: "Red", s: rs, color: "text-crimson" }].map(({ label, s, color }) => (
              <p key={label} className={`font-mono text-xs ${color} leading-relaxed`}>
                {label}: ({s.rankScore.toFixed(1)}×0.4 + {s.roleScore.toFixed(1)}×0.35 + {s.contribRaw.toFixed(1)}×0.25) × {s.moodMult.toFixed(2)} = <span className="font-bold">{s.total.toFixed(1)}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlayersPage() {
  const [result, setResult] = useState<BalanceResult | null>(null);
  const { ref: contentRef, copy: copyImage, copying } = useCopyImage();
  const { toastMsg, showToast } = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("balancer_result");
      if (stored) setResult(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  async function handleCopy() {
    const ok = await copyImage();
    showToast(ok ? "画像をコピーしました" : "コピーに失敗しました（ブラウザ非対応の可能性）");
  }

  const matchups = result
    ? ALL_ROLES.flatMap((role) => {
        const blue = result.blueTeam.find((p) => p.assignedRole === role);
        const red = result.redTeam.find((p) => p.assignedRole === role);
        return blue && red ? [{ role, blue, red }] : [];
      })
    : [];

  const unmatched = result
    ? [
        ...result.blueTeam.filter((p) => !ALL_ROLES.includes(p.assignedRole as Role)),
        ...result.redTeam.filter((p) => !ALL_ROLES.includes(p.assignedRole as Role)),
      ]
    : [];

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-wire px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-end justify-between">
          <div>
            <p className="font-mono text-xs text-ink-dim tracking-widest uppercase mb-1">
              League of Legends · Custom Match
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              LANE <span className="text-gold">MATCHUPS</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={copying || !result}
              className="font-mono text-sm text-ink-dim border border-wire px-3 py-1.5 hover:border-wire-bright hover:text-ink disabled:opacity-30 transition-colors"
            >
              {copying ? "..." : "画像コピー"}
            </button>
            <Link
              href="/"
              className="font-mono text-sm text-ink-dim border border-wire px-3 py-1.5 hover:border-wire-bright hover:text-ink transition-colors"
            >
              ← ホームに戻る
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {!result ? (
          <div className="border border-wire bg-surface px-6 py-12 text-center">
            <p className="font-mono text-sm text-ink-muted">
              チーム分けを実行してからこのページを開いてください
            </p>
            <Link href="/" className="font-mono text-sm text-gold mt-3 inline-block hover:text-gold-bright">
              ← ホームへ
            </Link>
          </div>
        ) : (
          <>
            {/* チームスコアサマリー */}
            <div className="grid grid-cols-2 gap-px bg-wire mb-6">
              <div className="bg-surface px-5 py-4 border-l-2 border-l-azure">
                <p className="font-mono text-xs text-azure uppercase tracking-widest mb-1">Blue Team</p>
                <p className="font-mono text-3xl font-bold text-azure">{result.blueScore}</p>
              </div>
              <div className="bg-surface px-5 py-4 border-l-2 border-l-crimson">
                <p className="font-mono text-xs text-crimson uppercase tracking-widest mb-1">Red Team</p>
                <p className="font-mono text-3xl font-bold text-crimson">{result.redScore}</p>
              </div>
            </div>

            <div ref={contentRef}>
              {/* 列ヘッダー */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="font-mono text-xs text-azure uppercase tracking-widest flex-1 text-center">
                  Blue Side
                </span>
                <span className="w-20" />
                <span className="font-mono text-xs text-crimson uppercase tracking-widest flex-1 text-center">
                  Red Side
                </span>
              </div>

              {/* 対面マッチアップ */}
              <div className="flex flex-col gap-3">
                {matchups.map(({ role, blue, red }) => (
                  <LaneMatchup key={role} blue={blue} red={red} />
                ))}
              </div>

              {/* 未割り当てプレイヤー */}
              {unmatched.length > 0 && (
                <div className="mt-6 border border-wire bg-surface px-4 py-3">
                  <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">未割り当て</p>
                  <div className="flex flex-wrap gap-2">
                    {unmatched.map((p) => (
                      <span key={p.id} className="font-mono text-sm text-ink-dim border border-wire px-2 py-1">
                        {p.summonerName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-wire-bright text-ink px-5 py-3 text-sm font-mono z-50">
          {toastMsg}
        </div>
      )}
    </main>
  );
}
