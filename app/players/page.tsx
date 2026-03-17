"use client";

import { useEffect, useState } from "react";
import type { BalanceResult, PlayerData, Role } from "@/types";
import { calcRankScore, calcRoleScore, calcTotalScore } from "@/lib/score";

const MOOD_LABELS = ["疲れ気味", "普通", "好調", "絶好調"];
const MOOD_MULT = [0.75, 1.0, 1.15, 1.3];
const ROLE_SHORT: Record<string, string> = {
  TOP: "TOP", JUNGLE: "JGL", MID: "MID", BOT: "BOT", SUPPORT: "SUP",
};
const TIER_COLOR: Record<string, string> = {
  IRON: "text-ink-dim", BRONZE: "text-amber-600", SILVER: "text-ink-dim",
  GOLD: "text-gold", PLATINUM: "text-teal-400", EMERALD: "text-emerald-400",
  DIAMOND: "text-azure", MASTER: "text-purple-400", GRANDMASTER: "text-crimson",
  CHALLENGER: "text-gold-bright",
};

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex-1 h-1.5 bg-raised">
      <div className={`h-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function PlayerDetail({ player, team }: { player: PlayerData; team: "blue" | "red" }) {
  const rankScore = calcRankScore(player.tier, player.rank, player.lp);
  const effectiveRole = player.assignedRole ?? player.preferredRoles[0];
  const roleScore = effectiveRole
    ? calcRoleScore(player, effectiveRole)
    : rankScore * 0.8;
  const contribRaw = player.contributionScore.raw;
  const moodMult = MOOD_MULT[player.mood];
  const total = calcTotalScore(player);

  const rankComponent  = rankScore  * 0.4;
  const roleComponent  = roleScore  * 0.35;
  const contribComponent = contribRaw * 0.25;
  const subtotal = rankComponent + roleComponent + contribComponent;

  const teamAccent = team === "blue" ? "border-l-azure" : "border-l-crimson";
  const teamLabel  = team === "blue" ? "text-azure" : "text-crimson";

  return (
    <div className={`bg-surface border-l-2 ${teamAccent}`}>
      {/* ヘッダー */}
      <div className="px-5 py-4 border-b border-wire flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-mono text-xs uppercase tracking-widest ${teamLabel}`}>
              {team === "blue" ? "BLUE" : "RED"}{effectiveRole ? ` · ${ROLE_SHORT[effectiveRole] ?? effectiveRole}` : ""}
            </span>
          </div>
          <p className="font-semibold text-ink text-base">{player.summonerName}</p>
          <p className="font-mono text-sm text-ink-dim">{player.riotId}</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-sm font-bold ${TIER_COLOR[player.tier] ?? "text-ink"}`}>
            {player.tier} {player.rank}
          </p>
          <p className="font-mono text-sm text-ink-dim">{player.lp} LP</p>
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-5">
        {/* 自動タグ */}
        {(player.autoTags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {player.autoTags!.map((tag) => (
              <span key={tag} className="font-mono text-xs border border-gold/50 text-gold px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* スコア内訳 */}
        <div>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-3">Score Breakdown</p>
          <div className="flex flex-col gap-2">
            {/* ランクスコア */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-ink-dim w-24">RANK ×0.4</span>
              <ScoreBar value={rankComponent} max={40} color="bg-azure" />
              <span className="font-mono text-sm text-ink w-12 text-right">{rankComponent.toFixed(1)}</span>
            </div>
            {/* ロールスコア */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-ink-dim w-24">
                ROLE ×0.35{effectiveRole ? ` (${ROLE_SHORT[effectiveRole] ?? effectiveRole})` : ""}
              </span>
              <ScoreBar value={roleComponent} max={35} color="bg-gold" />
              <span className="font-mono text-sm text-ink w-12 text-right">{roleComponent.toFixed(1)}</span>
            </div>
            {/* 貢献スコア */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-ink-dim w-24">CONTRIB ×0.25</span>
              <ScoreBar value={contribComponent} max={25} color="bg-emerald-500" />
              <span className="font-mono text-sm text-ink w-12 text-right">{contribComponent.toFixed(1)}</span>
            </div>
          </div>

          {/* 合計 */}
          <div className="mt-3 pt-3 border-t border-wire flex items-center justify-between">
            <span className="font-mono text-xs text-ink-muted">
              {subtotal.toFixed(1)} × mood {MOOD_LABELS[player.mood]} (×{moodMult})
            </span>
            <span className="font-mono text-xl font-bold text-ink">{total.toFixed(1)}</span>
          </div>
        </div>

        {/* 貢献度詳細 */}
        <div>
          <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">Contribution Detail</p>
          <div className="grid grid-cols-3 gap-px bg-wire text-center">
            <div className="bg-surface py-2">
              <p className="font-mono text-xs text-ink-muted">Vision</p>
              <p className="font-mono text-sm font-bold text-ink">{player.contributionScore.visionScore.toFixed(1)}</p>
            </div>
            <div className="bg-surface py-2">
              <p className="font-mono text-xs text-ink-muted">TF参加率</p>
              <p className="font-mono text-sm font-bold text-ink">
                {(player.contributionScore.teamFightParticipation * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-surface py-2">
              <p className="font-mono text-xs text-ink-muted">CW購入</p>
              <p className="font-mono text-sm font-bold text-ink">
                {player.contributionScore.controlWardsBought.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        {/* ロール別スタッツ */}
        {Object.keys(player.roleStats).length > 0 && (
          <div>
            <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-2">Role Stats</p>
            <div className="flex flex-col divide-y divide-wire">
              {Object.entries(player.roleStats)
                .sort((a, b) => b[1].games - a[1].games)
                .map(([role, stats]) => (
                  <div key={role} className={`flex items-center gap-4 py-2 ${
                    role === effectiveRole ? "text-ink" : "text-ink-dim"
                  }`}>
                    <span className={`font-mono text-xs w-8 font-bold ${role === effectiveRole ? "text-gold" : ""}`}>
                      {ROLE_SHORT[role] ?? role}
                    </span>
                    <span className="font-mono text-sm w-12">{stats.games}試合</span>
                    <span className="font-mono text-sm w-16">
                      勝率 {(stats.winRate * 100).toFixed(0)}%
                    </span>
                    <span className="font-mono text-sm w-16">
                      KDA {stats.avgKDA.toFixed(1)}
                    </span>
                    <span className="font-mono text-sm">
                      CS {stats.avgCSperMin.toFixed(1)}/m
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayersPage() {
  const [result, setResult] = useState<BalanceResult | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("balancer_result");
      if (stored) setResult(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const allPlayers: { player: PlayerData; team: "blue" | "red" }[] = result
    ? [
        ...result.blueTeam.map((p) => ({ player: p, team: "blue" as const })),
        ...result.redTeam.map((p) => ({ player: p, team: "red" as const })),
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
              PLAYER <span className="text-gold">STATS</span>
            </h1>
          </div>
          <a
            href="/"
            className="font-mono text-sm text-ink-dim border border-wire px-3 py-1.5 hover:border-wire-bright hover:text-ink transition-colors"
          >
            ← ホームに戻る
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {!result ? (
          <div className="border border-wire bg-surface px-6 py-12 text-center">
            <p className="font-mono text-sm text-ink-muted">
              チーム分けを実行してからこのページを開いてください
            </p>
            <a href="/" className="font-mono text-sm text-gold mt-3 inline-block hover:text-gold-bright">
              ← ホームへ
            </a>
          </div>
        ) : (
          <>
            {/* チームスコアサマリー */}
            <div className="grid grid-cols-2 gap-px bg-wire mb-8">
              <div className="bg-surface px-5 py-4">
                <p className="font-mono text-xs text-azure uppercase tracking-widest mb-1">Blue Team</p>
                <p className="font-mono text-3xl font-bold text-azure">{result.blueScore}</p>
              </div>
              <div className="bg-surface px-5 py-4 text-right">
                <p className="font-mono text-xs text-crimson uppercase tracking-widest mb-1">Red Team</p>
                <p className="font-mono text-3xl font-bold text-crimson">{result.redScore}</p>
              </div>
            </div>

            {/* プレイヤー詳細グリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-wire">
              {allPlayers.map(({ player, team }) => (
                <PlayerDetail key={player.id} player={player} team={team} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
