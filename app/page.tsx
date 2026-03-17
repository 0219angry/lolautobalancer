"use client";

import { useState, useCallback } from "react";
import type { PlayerData, BalanceResult, Role } from "@/types";
import PlayerCard from "@/components/PlayerCard";
import TeamResult from "@/components/TeamResult";

const PLAYER_COUNT = 10;

export default function Home() {
  const [players, setPlayers] = useState<(PlayerData | null)[]>(Array(PLAYER_COUNT).fill(null));
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [balancing, setBalancing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const readyCount = players.filter(Boolean).length;
  const allReady = readyCount === PLAYER_COUNT;

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  const handleDataChange = useCallback((index: number, data: PlayerData | null) => {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = data;
      return next;
    });
  }, []);

  async function balance(playerList: PlayerData[]) {
    setBalancing(true);
    try {
      const res = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: playerList }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "チーム分け失敗");
      }
      const data: BalanceResult = await res.json();
      setResult(data);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBalancing(false);
    }
  }

  async function handleBalance() {
    const filled = players.filter(Boolean) as PlayerData[];
    if (filled.length !== PLAYER_COUNT) return;
    await balance(filled);
  }

  async function handleReshuffle() {
    if (!result) return;
    const all = [...result.blueTeam, ...result.redTeam].map((p) => ({ ...p, assignedRole: undefined }));
    await balance(all);
  }

  function handleRoleChange(team: "blue" | "red", playerId: string, role: Role) {
    if (!result) return;

    const updateTeam = (arr: PlayerData[]) =>
      arr.map((p) => (p.id === playerId ? { ...p, assignedRole: role } : p));

    const next: BalanceResult = {
      ...result,
      blueTeam: team === "blue" ? updateTeam(result.blueTeam) : result.blueTeam,
      redTeam: team === "red" ? updateTeam(result.redTeam) : result.redTeam,
    };

    // ロール被りチェック
    const hasDuplicates = (arr: PlayerData[]) => {
      const roles = arr.map((p) => p.assignedRole).filter(Boolean);
      return roles.length !== new Set(roles).size;
    };
    if (hasDuplicates(next.blueTeam) || hasDuplicates(next.redTeam)) {
      showToast("⚠ ロール被りがあります");
    }

    setResult(next);
  }

  async function handleReconfirm() {
    if (!result) return;
    const all = [...result.blueTeam, ...result.redTeam];
    await balance(all);
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-yellow-400">⚔ LoL Custom Team Balancer</h1>
          <p className="text-gray-400 text-sm mt-1">10人のプレイヤーを公平な2チームに自動分けします</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-8">
        {/* プレイヤー入力 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-200">
              プレイヤー入力
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({readyCount} / {PLAYER_COUNT} 人)
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: PLAYER_COUNT }, (_, i) => (
              <PlayerCard key={i} index={i} onDataChange={handleDataChange} />
            ))}
          </div>
        </section>

        {/* チームを分けるボタン */}
        <div className="flex justify-center">
          <button
            onClick={handleBalance}
            disabled={!allReady || balancing}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-bold text-lg px-10 py-3 rounded-xl transition-colors shadow-lg"
          >
            {balancing ? "計算中…" : `⚔ チームを分ける (${readyCount}/${PLAYER_COUNT})`}
          </button>
        </div>

        {/* チーム分け結果 */}
        {result && (
          <section>
            <h2 className="text-lg font-bold text-gray-200 mb-4">チーム分け結果</h2>
            <TeamResult
              result={result}
              onRoleChange={handleRoleChange}
              onReconfirm={handleReconfirm}
              onReshuffle={handleReshuffle}
            />
          </section>
        )}
      </div>

      {/* トースト */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-700 text-white px-5 py-3 rounded-xl shadow-xl text-sm z-50">
          {toastMsg}
        </div>
      )}
    </main>
  );
}
