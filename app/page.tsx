"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { PlayerData, BalanceResult, Role } from "@/types";
import PlayerCard from "@/components/PlayerCard";
import TeamResult from "@/components/TeamResult";
import { fetchPlayerData } from "@/lib/fetchPlayer";

const PLAYER_COUNT = 10;

export default function Home() {
  const [players, setPlayers] = useState<(PlayerData | null)[]>(Array(PLAYER_COUNT).fill(null));
  const [preloadedPlayers, setPreloadedPlayers] = useState<(PlayerData | null)[]>(Array(PLAYER_COUNT).fill(null));
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [balancing, setBalancing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 一括入力
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // テキストから Riot ID を抽出（チャット形式含む）
  // 例: "[All] TsuyukusaYu#M893: gg" → "TsuyukusaYu#M893"
  const parsedIds = useMemo(() => {
    const matches = bulkText.matchAll(/([^\s\[\]:#]+#[A-Za-z0-9]{1,5})/g);
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const m of matches) {
      const id = m[1];
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [bulkText]);

  const readyCount = players.filter(Boolean).length;
  const allReady = readyCount === PLAYER_COUNT;

  function showToast(msg: string) {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMsg(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }

  const handleDataChange = useCallback((index: number, data: PlayerData | null) => {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = data;
      return next;
    });
  }, []);

  async function handleBulkImport() {
    if (parsedIds.length === 0) {
      showToast("Riot ID が1件も見つかりません（例: PlayerName#JP1）");
      return;
    }
    if (parsedIds.length > PLAYER_COUNT) {
      showToast(`最大 ${PLAYER_COUNT} 件まで入力できます（現在 ${parsedIds.length} 件）`);
      return;
    }

    setBulkLoading(true);
    setBulkProgress({ done: 0, total: parsedIds.length });

    const results: (PlayerData | null)[] = Array(PLAYER_COUNT).fill(null);
    const errors: string[] = [];

    for (let i = 0; i < parsedIds.length; i++) {
      try {
        const data = await fetchPlayerData(parsedIds[i], i);
        results[i] = data;
      } catch (e) {
        errors.push(`${parsedIds[i]}: ${e instanceof Error ? e.message : "取得失敗"}`);
        results[i] = null;
      }
      setBulkProgress({ done: i + 1, total: parsedIds.length });
    }

    setPreloadedPlayers([...results]);
    setPlayers([...results]);
    setBulkLoading(false);
    setBulkProgress(null);
    setBulkOpen(false);
    setBulkText("");

    if (errors.length > 0) {
      showToast(`${errors.length} 件取得失敗: ${errors[0]}${errors.length > 1 ? " 他" : ""}`);
    } else {
      showToast(`${parsedIds.length} 人のデータを取得しました`);
    }
  }

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
            <button
              onClick={() => setBulkOpen((v) => !v)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              {bulkOpen ? "閉じる" : "一括入力"}
            </button>
          </div>

          {/* 一括入力パネル */}
          {bulkOpen && (
            <div className="mb-4 bg-gray-800 border border-gray-600 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-gray-400 text-xs">
                ゲーム内チャットをそのままペーストできます。<code className="bg-gray-700 px-1 rounded">Name#TAG</code> 形式の Riot ID を自動抽出します（最大 {PLAYER_COUNT} 人）
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"[All] TsuyukusaYu#M893: よろしく\n[All] Player2#JP1: gg\n\n--- または Riot ID 直接入力 ---\nPlayer3#JP1\nPlayer4#M893"}
                rows={7}
                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
              />

              {/* 抽出プレビュー */}
              {parsedIds.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-gray-400 text-xs">
                    検出された Riot ID：
                    <span className={parsedIds.length > PLAYER_COUNT ? "text-red-400" : "text-green-400"}>
                      {" "}{parsedIds.length} 件
                    </span>
                    {parsedIds.length > PLAYER_COUNT && ` （上位 ${PLAYER_COUNT} 件のみ使用されます）`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedIds.slice(0, PLAYER_COUNT).map((id) => (
                      <span key={id} className="bg-gray-700 text-gray-200 text-xs px-2 py-0.5 rounded-full font-mono">
                        {id}
                      </span>
                    ))}
                    {parsedIds.length > PLAYER_COUNT && (
                      <span className="text-red-400 text-xs px-2 py-0.5">
                        +{parsedIds.length - PLAYER_COUNT} 件（無視）
                      </span>
                    )}
                  </div>
                </div>
              )}

              {bulkProgress && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                  <span>{bulkProgress.done} / {bulkProgress.total}</span>
                </div>
              )}
              <button
                onClick={handleBulkImport}
                disabled={bulkLoading || parsedIds.length === 0}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {bulkLoading ? "取得中…" : `一括取得 (${Math.min(parsedIds.length, PLAYER_COUNT)} 人)`}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: PLAYER_COUNT }, (_, i) => (
              <PlayerCard key={i} index={i} onDataChange={handleDataChange} preloadedData={preloadedPlayers[i]} />
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
