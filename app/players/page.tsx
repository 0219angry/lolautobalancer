"use client";

import { useEffect, useState } from "react";
import type { BalanceResult, PlayerData, Role } from "@/types";
import { calcRankScore, calcRoleScore, calcTotalScore } from "@/lib/score";
import { useCopyImage } from "@/lib/useCopyImage";

const ALL_ROLES: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
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

function calcScores(player: PlayerData) {
  const rankScore = calcRankScore(player.tier, player.rank, player.lp);
  const role = player.assignedRole ?? player.preferredRoles[0];
  const roleScore = role ? calcRoleScore(player, role) : rankScore * 0.8;
  const contribRaw = player.contributionScore.raw;
  const moodMult = MOOD_MULT[player.mood];
  const rankComponent = rankScore * 0.4;
  const roleComponent = roleScore * 0.35;
  const contribComponent = contribRaw * 0.25;
  const total = calcTotalScore(player);
  return { rankComponent, roleComponent, contribComponent, moodMult, total };
}

// 左右の値を比較して勝ち負けのスタイルを返す
function cmp(a: number, b: number): { a: string; b: string } {
  if (Math.abs(a - b) < 0.5) return { a: "text-ink", b: "text-ink" };
  return a > b
    ? { a: "text-azure font-bold", b: "text-ink-dim" }
    : { a: "text-ink-dim", b: "text-crimson font-bold" };
}

function StatRow({
  label,
  blueVal,
  redVal,
  fmt = (v: number) => v.toFixed(1),
  showBar = false,
}: {
  label: string;
  blueVal: number;
  redVal: number;
  fmt?: (v: number) => string;
  showBar?: boolean;
}) {
  const { a, b } = cmp(blueVal, redVal);
  const total = blueVal + redVal;
  const bluePct = total > 0 ? (blueVal / total) * 100 : 50;
  const redPct = 100 - bluePct;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={`font-mono text-sm w-20 text-right ${a}`}>{fmt(blueVal)}</span>
      <div className="flex-1 flex flex-col gap-1">
        <span className="font-mono text-xs text-ink-muted text-center">{label}</span>
        {showBar && (
          <div className="flex h-1.5">
            <div className="bg-azure h-full transition-all duration-500" style={{ width: `${bluePct}%` }} />
            <div className="bg-crimson h-full transition-all duration-500" style={{ width: `${redPct}%` }} />
          </div>
        )}
      </div>
      <span className={`font-mono text-sm w-20 ${b}`}>{fmt(redVal)}</span>
    </div>
  );
}

function LaneMatchup({ blue, red }: { blue: PlayerData; red: PlayerData }) {
  const bs = calcScores(blue);
  const rs = calcScores(red);
  const scoreDiff = Math.abs(bs.total - rs.total);
  const role = blue.assignedRole ?? blue.preferredRoles[0];

  const blueRole = blue.roleStats[role ?? ""];
  const redRole = red.roleStats[role ?? ""];

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
      </div>

      {/* プレイヤー名・ランク行 */}
      <div className="grid grid-cols-2 gap-px bg-wire">
        {/* Blue */}
        <div className="bg-surface px-4 py-3 border-l-2 border-l-azure">
          <p className="font-semibold text-ink text-sm truncate">{blue.summonerName}</p>
          <p className={`font-mono text-xs ${TIER_COLOR[blue.tier] ?? "text-ink"}`}>
            {blue.tier} {blue.rank} {blue.lp}LP
          </p>
          <p className="font-mono text-xs text-ink-muted mt-0.5">{MOOD_LABELS[blue.mood]}</p>
        </div>
        {/* Red */}
        <div className="bg-surface px-4 py-3 border-l-2 border-l-crimson">
          <p className="font-semibold text-ink text-sm truncate">{red.summonerName}</p>
          <p className={`font-mono text-xs ${TIER_COLOR[red.tier] ?? "text-ink"}`}>
            {red.tier} {red.rank} {red.lp}LP
          </p>
          <p className="font-mono text-xs text-ink-muted mt-0.5">{MOOD_LABELS[red.mood]}</p>
        </div>
      </div>

      {/* スコア比較 */}
      <div className="px-4 py-3 border-t border-wire">
        <StatRow label="Total Score" blueVal={bs.total} redVal={rs.total} showBar />
        <StatRow label="Rank" blueVal={bs.rankComponent} redVal={rs.rankComponent} />
        <StatRow label="Role" blueVal={bs.roleComponent} redVal={rs.roleComponent} />
        <StatRow label="Contrib" blueVal={bs.contribComponent} redVal={rs.contribComponent} />

        {/* ロール別スタッツ（履歴あれば） */}
        {(blueRole || redRole) && (
          <>
            <div className="border-t border-wire mt-2 pt-2">
              <StatRow
                label="勝率"
                blueVal={(blueRole?.winRate ?? 0) * 100}
                redVal={(redRole?.winRate ?? 0) * 100}
                fmt={(v) => `${v.toFixed(0)}%`}
              />
              <StatRow
                label="KDA"
                blueVal={blueRole?.avgKDA ?? 0}
                redVal={redRole?.avgKDA ?? 0}
              />
              <StatRow
                label="CS/m"
                blueVal={blueRole?.avgCSperMin ?? 0}
                redVal={redRole?.avgCSperMin ?? 0}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PlayersPage() {
  const [result, setResult] = useState<BalanceResult | null>(null);
  const { ref: contentRef, copy: copyImage, copying } = useCopyImage();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("balancer_result");
      if (stored) setResult(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  async function handleCopy() {
    await copyImage();
    setToastMsg("画像をコピーしました");
    setTimeout(() => setToastMsg(null), 3000);
  }

  const matchups = result
    ? ALL_ROLES.flatMap((role) => {
        const blue = result.blueTeam.find((p) => p.assignedRole === role);
        const red = result.redTeam.find((p) => p.assignedRole === role);
        return blue && red ? [{ role, blue, red }] : [];
      })
    : [];

  // ロールなし（未割り当て）プレイヤー
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
            <a
              href="/"
              className="font-mono text-sm text-ink-dim border border-wire px-3 py-1.5 hover:border-wire-bright hover:text-ink transition-colors"
            >
              ← ホームに戻る
            </a>
          </div>
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
