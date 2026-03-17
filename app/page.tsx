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

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [cardResetKey, setCardResetKey] = useState(0);

  const readyCount = players.filter(Boolean).length;
  const allReady = readyCount === PLAYER_COUNT;

  function showToast(msg: string) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
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

  // テキストから Riot ID を抽出（参加/退出ログ対応）
  const parsedIds = useMemo(() => {
    const RIOT_ID = /([^\s\[\]:#]+#[A-Za-z0-9]{1,5})/;
    const joined = new Set<string>();
    const left = new Set<string>();
    const order: string[] = [];

    for (const line of bulkText.split("\n")) {
      const m = line.match(RIOT_ID);
      if (!m) continue;
      const id = m[1];

      if (line.includes("退出しました") || line.includes("left the lobby")) {
        left.add(id);
      } else {
        if (!joined.has(id)) order.push(id);
        joined.add(id);
        left.delete(id);
      }
    }
    return order.filter((id) => !left.has(id));
  }, [bulkText]);

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

    await Promise.all(
      parsedIds.slice(0, PLAYER_COUNT).map(async (id, i) => {
        try {
          const data = await fetchPlayerData(id, i);
          results[i] = data;
        } catch (e) {
          errors.push(`${id}: ${e instanceof Error ? e.message : "取得失敗"}`);
          results[i] = null;
        }
        setBulkProgress((prev) => ({ done: (prev?.done ?? 0) + 1, total: parsedIds.length }));
      })
    );

    setPreloadedPlayers([...results]);
    setPlayers([...results]);
    setCardResetKey((k) => k + 1);
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
    const hasDuplicates = (arr: PlayerData[]) => {
      const roles = arr.map((p) => p.assignedRole).filter(Boolean);
      return roles.length !== new Set(roles).size;
    };
    if (hasDuplicates(next.blueTeam) || hasDuplicates(next.redTeam)) {
      showToast("ロール被りがあります");
    }
    setResult(next);
  }

  async function handleReconfirm() {
    if (!result) return;
    await balance([...result.blueTeam, ...result.redTeam]);
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      {/* ヘッダー */}
      <header className="border-b border-wire px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-end justify-between">
          <div>
            <p className="font-mono text-xs text-ink-dim tracking-widest uppercase mb-1">
              League of Legends · Custom Match
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              TEAM <span className="text-gold">BALANCER</span>
            </h1>
          </div>
          <p className="font-mono text-xs text-ink-muted hidden sm:block">JP1 · RIOT API v5</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-10">

        {/* プレイヤー入力 */}
        <section>
          {/* セクションヘッダー */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-ink-muted uppercase tracking-widest">Players</span>
              <span className="font-mono text-xs text-gold">{readyCount} / {PLAYER_COUNT}</span>
            </div>
            <button
              onClick={() => setBulkOpen((v) => !v)}
              className="border border-wire text-ink-dim text-xs px-3 py-1.5 tracking-wide hover:border-wire-bright hover:text-ink transition-colors"
            >
              {bulkOpen ? "閉じる" : "一括入力"}
            </button>
          </div>

          {/* 一括入力パネル */}
          {bulkOpen && (
            <div className="mb-5 border border-wire bg-surface p-5 flex flex-col gap-4">
              <div>
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-1">Bulk Import</p>
                <p className="text-xs text-ink-dim">
                  ロビーチャットをそのままペーストできます。参加/退出ログから現在の参加者を自動判定します。
                </p>
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"TsuyukusaYu#M893がロビーに参加しました\nPlayer2#JP1がロビーに参加しました\nPlayer2#JP1がロビーから退出しました\n\n[All] Player3#JP1: よろしく"}
                rows={6}
                className="bg-raised border border-wire text-ink text-xs font-mono px-3 py-2 placeholder-ink-muted focus:outline-none focus:border-wire-bright resize-y w-full"
              />

              {/* 抽出プレビュー */}
              {parsedIds.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">
                    Detected
                    <span className={`ml-2 ${parsedIds.length > PLAYER_COUNT ? "text-crimson" : "text-gold"}`}>
                      {parsedIds.length} ids
                    </span>
                    {parsedIds.length > PLAYER_COUNT && ` — 上位 ${PLAYER_COUNT} 件のみ使用`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedIds.slice(0, PLAYER_COUNT).map((id) => (
                      <span key={id} className="border border-wire-bright text-ink-dim font-mono text-xs px-2 py-0.5">
                        {id}
                      </span>
                    ))}
                    {parsedIds.length > PLAYER_COUNT && (
                      <span className="text-crimson font-mono text-xs px-2 py-0.5">
                        +{parsedIds.length - PLAYER_COUNT}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {bulkProgress && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-raised border border-wire h-1">
                    <div
                      className="bg-gold h-full transition-all duration-200"
                      style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-ink-dim">{bulkProgress.done}/{bulkProgress.total}</span>
                </div>
              )}

              <button
                onClick={handleBulkImport}
                disabled={bulkLoading || parsedIds.length === 0}
                className="border border-gold text-gold font-mono text-xs uppercase tracking-widest px-4 py-2 hover:bg-gold hover:text-canvas disabled:opacity-30 disabled:cursor-not-allowed transition-colors self-start"
              >
                {bulkLoading ? "取得中..." : `取得 (${Math.min(parsedIds.length, PLAYER_COUNT)}人)`}
              </button>
            </div>
          )}

          {/* カードグリッド */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-wire">
            {Array.from({ length: PLAYER_COUNT }, (_, i) => (
              <PlayerCard
                key={`${i}-${cardResetKey}`}
                index={i}
                onDataChange={handleDataChange}
                preloadedData={preloadedPlayers[i]}
              />
            ))}
          </div>
        </section>

        {/* チームを分けるボタン */}
        <div className="flex justify-center">
          <button
            onClick={handleBalance}
            disabled={!allReady || balancing}
            className="border border-gold text-gold font-mono font-bold uppercase tracking-widest px-16 py-3 hover:bg-gold hover:text-canvas disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {balancing ? "Calculating..." : `Balance Teams (${readyCount}/${PLAYER_COUNT})`}
          </button>
        </div>

        {/* チーム分け結果 */}
        {result && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span className="font-mono text-xs text-ink-muted uppercase tracking-widest">Result</span>
              <span className="flex-1 h-px bg-wire" />
            </div>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-wire-bright text-ink px-5 py-3 text-xs font-mono z-50">
          {toastMsg}
        </div>
      )}
    </main>
  );
}
