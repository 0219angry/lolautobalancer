"use client";

import { useState, useEffect } from "react";
import type { PlayerInput, PlayerData, Mood, Role, Tier } from "@/types";
import { fetchPlayerData } from "@/lib/fetchPlayer";
import { getCacheAgeMin } from "@/lib/playerCache";

const ROLES: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
const ROLE_SHORT: Record<Role, string> = {
  TOP: "TOP", JUNGLE: "JGL", MID: "MID", BOT: "BOT", SUPPORT: "SUP",
};
const MOOD_LABELS: Record<Mood, string> = {
  0: "疲れ気味", 1: "普通", 2: "好調", 3: "絶好調",
};
const TIER_LABELS: Tier[] = [
  "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM",
  "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER",
];
const RANK_OPTIONS = ["IV", "III", "II", "I"];

interface Props {
  index: number;
  onDataChange: (index: number, data: PlayerData | null) => void;
  preloadedData?: PlayerData | null;
}

export default function PlayerCard({ index, onDataChange, preloadedData }: Props) {
  const [riotId, setRiotId] = useState("");
  const [mood, setMood] = useState<Mood>(1);
  const [preferredRoles, setPreferredRoles] = useState<(Role | null)[]>([null, null]);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const [manualTier, setManualTier] = useState<Tier>("GOLD");
  const [manualRank, setManualRank] = useState("IV");
  const [manualLp, setManualLp] = useState(0);
  const [manualContrib, setManualContrib] = useState(50);


  useEffect(() => {
    if (!preloadedData) return;
    setRiotId(preloadedData.riotId);
    setMood(preloadedData.mood);
    setPreferredRoles([preloadedData.preferredRoles[0] ?? null, preloadedData.preferredRoles[1] ?? null]);
    setPlayerData(preloadedData);
    setError(null);
    setManualMode(false);
  }, [preloadedData]);

  async function fetchPlayer(skipCache = false) {
    if (!riotId.trim().includes("#")) {
      setError("Riot ID は「名前#タグ」形式で入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlayerData(riotId, index, skipCache);
      const hasPreferred = preferredRoles.filter(Boolean).length > 0;
      if (hasPreferred) {
        data.preferredRoles = preferredRoles.filter(Boolean) as Role[];
      } else {
        setPreferredRoles([data.preferredRoles[0] ?? null, data.preferredRoles[1] ?? null]);
      }
      data.mood = mood;
      setPlayerData({ ...data });
      onDataChange(index, data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "取得失敗";
      setError(msg);
      setManualMode(true);
    } finally {
      setLoading(false);
    }
  }

  function applyManualInput() {
    const data: PlayerData = {
      id: `player-${index}`,
      riotId: riotId.trim() || `Player${index + 1}`,
      puuid: "",
      summonerName: riotId.trim() || `Player${index + 1}`,
      tier: manualTier,
      rank: manualRank,
      lp: manualLp,
      preferredRoles: preferredRoles.filter(Boolean) as Role[],
      roleStats: {},
      contributionScore: { visionScore: 0, teamFightParticipation: 0, controlWardsBought: 0, raw: manualContrib },
      mood,
    };
    setPlayerData(data);
    onDataChange(index, data);
  }

  function updateMood(m: Mood) {
    setMood(m);
    if (playerData) {
      const updated = { ...playerData, mood: m };
      setPlayerData(updated);
      onDataChange(index, updated);
    }
  }

  function updatePreferredRole(idx: 0 | 1, role: Role | "") {
    const next: (Role | null)[] = [...preferredRoles];
    next[idx] = role === "" ? null : role;
    if (idx === 0 && role !== "" && next[1] === role) next[1] = null;
    setPreferredRoles(next);
    if (playerData) {
      const updated = { ...playerData, preferredRoles: next.filter(Boolean) as Role[] };
      setPlayerData(updated);
      onDataChange(index, updated);
    }
  }

  function clearPlayer() {
    setPlayerData(null);
    setRiotId("");
    setError(null);
    setManualMode(false);
    setPreferredRoles([null, null]);
    onDataChange(index, null);
  }

  const tierColor: Record<string, string> = {
    IRON: "text-ink-dim", BRONZE: "text-amber-600", SILVER: "text-ink-dim",
    GOLD: "text-gold", PLATINUM: "text-teal-400", EMERALD: "text-emerald-400",
    DIAMOND: "text-azure", MASTER: "text-purple-400", GRANDMASTER: "text-crimson",
    CHALLENGER: "text-gold-bright",
  };

  const leftBorderClass = playerData
    ? "border-l-gold"
    : error
    ? "border-l-crimson"
    : "border-l-wire";

  return (
    <div className={`bg-surface border-l-2 ${leftBorderClass} flex flex-col`}>
      {/* 入力行 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-wire">
        <span className="font-mono text-sm text-ink-muted w-5 flex-shrink-0">
          {String(index + 1).padStart(2, "0")}
        </span>
        <input
          type="text"
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchPlayer()}
          onBlur={() => riotId && !playerData && fetchPlayer()}
          placeholder="PlayerName#JP1"
          disabled={loading}
          className="flex-1 bg-transparent text-ink text-sm font-mono font-medium placeholder-ink-muted focus:outline-none min-w-0"
        />
        {playerData ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(() => {
              const age = getCacheAgeMin(riotId);
              return age !== null ? (
                <span className="font-mono text-xs text-ink-muted">{age}分前</span>
              ) : null;
            })()}
            <button
              onClick={() => { setPlayerData(null); fetchPlayer(true); }}
              title="再取得"
              className="font-mono text-xs text-ink-muted hover:text-gold transition-colors"
            >
              ↺
            </button>
            <button
              onClick={clearPlayer}
              className="text-ink-muted text-sm hover:text-crimson transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => fetchPlayer()}
            disabled={loading || !riotId}
            className="border border-wire text-ink-dim text-sm px-3 py-1 hover:border-wire-bright hover:text-ink disabled:opacity-30 transition-colors flex-shrink-0"
          >
            {loading ? "..." : "取得"}
          </button>
        )}
      </div>

      {/* エラー */}
      {error && !playerData && (
        <div className="px-4 py-2.5 border-b border-wire flex items-center justify-between">
          <span className="text-crimson text-sm font-mono truncate">{error}</span>
          <button
            onClick={() => { setError(null); setManualMode(true); }}
            className="text-ink-muted text-sm hover:text-ink ml-2 flex-shrink-0 underline"
          >
            手動入力
          </button>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="px-3 py-2 border-b border-wire">
          <div className="h-px bg-wire relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gold animate-pulse" />
          </div>
        </div>
      )}

      {/* 手動入力モード */}
      {manualMode && !playerData && (
        <div className="px-4 py-4 border-b border-wire flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <select
              value={manualTier}
              onChange={(e) => setManualTier(e.target.value as Tier)}
              className="bg-raised border border-wire text-ink font-mono text-sm px-2 py-1 focus:outline-none focus:border-wire-bright"
            >
              {TIER_LABELS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={manualRank}
              onChange={(e) => setManualRank(e.target.value)}
              className="bg-raised border border-wire text-ink font-mono text-sm px-2 py-1 focus:outline-none focus:border-wire-bright"
            >
              {RANK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              type="number" min={0} max={99} value={manualLp}
              onChange={(e) => setManualLp(Number(e.target.value))}
              className="bg-raised border border-wire text-ink font-mono text-sm px-2 py-1 w-16 focus:outline-none focus:border-wire-bright"
              placeholder="LP"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-ink-muted">貢献</span>
            <input
              type="range" min={0} max={100} value={manualContrib}
              onChange={(e) => setManualContrib(Number(e.target.value))}
              className="flex-1 accent-gold"
            />
            <span className="font-mono text-sm text-ink-dim w-6 text-right">{manualContrib}</span>
          </div>
          <button
            onClick={applyManualInput}
            className="border border-wire-bright text-ink text-sm px-3 py-1.5 hover:border-gold hover:text-gold transition-colors self-start"
          >
            確定
          </button>
        </div>
      )}

      {/* 取得済みプレイヤー情報 */}
      {playerData && (
        <div className="px-4 py-3 flex flex-col gap-2.5">
          {/* ランク行 */}
          <div className="flex items-center gap-2">
            <span className={`font-mono text-sm font-bold ${tierColor[playerData.tier] ?? "text-ink"}`}>
              {playerData.tier} {playerData.rank}
            </span>
            <span className="font-mono text-sm text-ink-dim">{playerData.lp}LP</span>
            <span className="text-sm font-semibold text-ink ml-auto truncate">{playerData.summonerName}</span>
          </div>

          {/* 希望ロール */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-ink-muted w-14">第1希望</span>
            <select
              value={preferredRoles[0] ?? ""}
              onChange={(e) => updatePreferredRole(0, e.target.value as Role | "")}
              className="bg-raised border border-wire text-ink font-mono text-sm px-2 py-1 flex-1 focus:outline-none focus:border-wire-bright"
            >
              <option value="">—</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_SHORT[r]}</option>)}
            </select>
            <span className="font-mono text-sm text-ink-muted w-14">第2希望</span>
            <select
              value={preferredRoles[1] ?? ""}
              onChange={(e) => updatePreferredRole(1, e.target.value as Role | "")}
              className="bg-raised border border-wire text-ink font-mono text-sm px-2 py-1 flex-1 focus:outline-none focus:border-wire-bright"
            >
              <option value="">—</option>
              {ROLES.filter((r) => r !== preferredRoles[0]).map((r) => (
                <option key={r} value={r}>{ROLE_SHORT[r]}</option>
              ))}
            </select>
          </div>

          {/* ムード */}
          <div className="flex gap-1 flex-wrap">
            {([0, 1, 2, 3] as Mood[]).map((m) => (
              <button
                key={m}
                onClick={() => updateMood(m)}
                className={`text-sm px-2.5 py-1 border transition-colors ${
                  mood === m
                    ? "border-gold text-gold"
                    : "border-wire text-ink-dim hover:border-wire-bright hover:text-ink"
                }`}
              >
                {MOOD_LABELS[m]}
              </button>
            ))}
          </div>

          {/* 自動タグ */}
          {(playerData.autoTags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5 border-t border-wire">
              {playerData.autoTags!.map((tag) => (
                <span key={tag} className="font-mono text-xs border border-gold/50 text-gold px-1.5 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
