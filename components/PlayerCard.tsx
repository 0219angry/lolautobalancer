"use client";

import { useState } from "react";
import type { PlayerInput, PlayerData, Mood, Role, Tier } from "@/types";

const ROLES: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
const MOOD_LABELS: Record<Mood, string> = {
  0: "😴 疲れ気味",
  1: "😐 普通",
  2: "😊 好調",
  3: "🔥 絶好調",
};
const TIER_LABELS: Tier[] = [
  "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM",
  "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER",
];
const RANK_OPTIONS = ["IV", "III", "II", "I"];

interface Props {
  index: number;
  onDataChange: (index: number, data: PlayerData | null) => void;
}

export default function PlayerCard({ index, onDataChange }: Props) {
  const [riotId, setRiotId] = useState("");
  const [mood, setMood] = useState<Mood>(1);
  const [preferredRoles, setPreferredRoles] = useState<(Role | null)[]>([null, null]);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // 手動モード用
  const [manualTier, setManualTier] = useState<Tier>("GOLD");
  const [manualRank, setManualRank] = useState("IV");
  const [manualLp, setManualLp] = useState(0);
  const [manualContrib, setManualContrib] = useState(50);

  async function fetchPlayer() {
    const parts = riotId.trim().split("#");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setError("Riot ID は「名前#タグ」形式で入力してください");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const [name, tag] = parts;
      const sumRes = await fetch(`/api/summoner?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`);
      if (!sumRes.ok) {
        const e = await sumRes.json();
        throw new Error(e.error ?? "サモナー取得失敗");
      }
      const sumData = await sumRes.json();

      const matchRes = await fetch(`/api/matches?puuid=${encodeURIComponent(sumData.puuid)}`);
      let roleStats = {};
      let fetchedPreferredRoles: Role[] = [];
      let contributionScore = { visionScore: 0, teamFightParticipation: 0, controlWardsBought: 0, raw: 50 };

      if (matchRes.ok) {
        const matchData = await matchRes.json();
        roleStats = matchData.roleStats;
        fetchedPreferredRoles = matchData.preferredRoles as Role[];
        contributionScore = matchData.contributionScore;
      }

      const hasPreferred = preferredRoles.filter(Boolean).length > 0;
      const roles = hasPreferred ? (preferredRoles.filter(Boolean) as Role[]) : fetchedPreferredRoles;

      const data: PlayerData = {
        id: `player-${index}`,
        riotId: riotId.trim(),
        puuid: sumData.puuid,
        summonerName: sumData.summonerName,
        tier: sumData.tier,
        rank: sumData.rank,
        lp: sumData.lp,
        preferredRoles: roles,
        roleStats,
        contributionScore,
        mood,
      };

      setPlayerData(data);
      if (fetchedPreferredRoles.length > 0 && !hasPreferred) {
        setPreferredRoles([fetchedPreferredRoles[0] ?? null, fetchedPreferredRoles[1] ?? null]);
      }
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
      contributionScore: {
        visionScore: 0,
        teamFightParticipation: 0,
        controlWardsBought: 0,
        raw: manualContrib,
      },
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

    // 第1希望変更時に第2希望と重複した場合、第2希望をクリア
    if (idx === 0 && role !== "" && next[1] === role) {
      next[1] = null;
    }

    setPreferredRoles(next);
    if (playerData) {
      const updated = { ...playerData, preferredRoles: next.filter(Boolean) as Role[] };
      setPlayerData(updated);
      onDataChange(index, updated);
    }
  }

  const tierColor: Record<string, string> = {
    IRON: "text-gray-400", BRONZE: "text-amber-700", SILVER: "text-gray-300",
    GOLD: "text-yellow-400", PLATINUM: "text-teal-400", EMERALD: "text-emerald-400",
    DIAMOND: "text-blue-400", MASTER: "text-purple-400", GRANDMASTER: "text-red-400",
    CHALLENGER: "text-yellow-300",
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm font-bold w-6">#{index + 1}</span>

        {/* Riot ID 入力 */}
        <input
          type="text"
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchPlayer()}
          onBlur={() => riotId && !playerData && fetchPlayer()}
          placeholder="PlayerName#JP1"
          className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={fetchPlayer}
          disabled={loading || !riotId}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          {loading ? "取得中…" : "取得"}
        </button>
      </div>

      {/* エラー */}
      {error && (
        <div className="text-red-400 text-xs bg-red-900/30 rounded px-2 py-1">
          {error}
          <button onClick={() => { setError(null); setManualMode(true); }} className="ml-2 underline">
            手動入力
          </button>
        </div>
      )}

      {/* スケルトン */}
      {loading && (
        <div className="animate-pulse flex gap-2">
          <div className="h-4 bg-gray-700 rounded w-20" />
          <div className="h-4 bg-gray-700 rounded w-16" />
        </div>
      )}

      {/* 手動入力モード */}
      {manualMode && !playerData && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <select
              value={manualTier}
              onChange={(e) => setManualTier(e.target.value as Tier)}
              className="bg-gray-700 text-white text-sm rounded px-2 py-1"
            >
              {TIER_LABELS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select
              value={manualRank}
              onChange={(e) => setManualRank(e.target.value)}
              className="bg-gray-700 text-white text-sm rounded px-2 py-1"
            >
              {RANK_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <input
              type="number" min={0} max={99} value={manualLp}
              onChange={(e) => setManualLp(Number(e.target.value))}
              className="bg-gray-700 text-white text-sm rounded px-2 py-1 w-20"
              placeholder="LP"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-xs">貢献度</label>
            <input
              type="range" min={0} max={100} value={manualContrib}
              onChange={(e) => setManualContrib(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-white text-xs w-8">{manualContrib}</span>
          </div>
          <button
            onClick={applyManualInput}
            className="bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg w-full transition-colors"
          >
            確定
          </button>
        </div>
      )}

      {/* 取得済みプレイヤー情報 */}
      {playerData && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${tierColor[playerData.tier] ?? "text-white"}`}>
              {playerData.tier} {playerData.rank}
            </span>
            <span className="text-gray-400 text-xs">{playerData.lp} LP</span>
            <span className="text-gray-300 text-xs ml-auto truncate">{playerData.summonerName}</span>
          </div>

          {/* ムード選択 */}
          <div className="flex gap-1 flex-wrap">
            {([0, 1, 2, 3] as Mood[]).map((m) => (
              <button
                key={m}
                onClick={() => updateMood(m)}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                  mood === m ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {MOOD_LABELS[m]}
              </button>
            ))}
          </div>

          {/* 希望ロール */}
          <div className="flex gap-2 items-center">
            <span className="text-gray-400 text-xs w-14">第1希望</span>
            <select
              value={preferredRoles[0] ?? ""}
              onChange={(e) => updatePreferredRole(0, e.target.value as Role | "")}
              className="bg-gray-700 text-white text-sm rounded px-2 py-1 flex-1"
            >
              <option value="">未指定</option>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <span className="text-gray-400 text-xs w-14">第2希望</span>
            <select
              value={preferredRoles[1] ?? ""}
              onChange={(e) => updatePreferredRole(1, e.target.value as Role | "")}
              className="bg-gray-700 text-white text-sm rounded px-2 py-1 flex-1"
            >
              <option value="">未指定</option>
              {ROLES.filter((r) => r !== preferredRoles[0]).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
