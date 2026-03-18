"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { PlayerData, BalanceResult, Role } from "@/types";
import PlayerCard from "@/components/PlayerCard";
import TeamResult from "@/components/TeamResult";
import { fetchPlayerData } from "@/lib/fetchPlayer";
import { useCopyImage } from "@/lib/useCopyImage";
import { useToast } from "@/lib/useToast";
const PLAYER_COUNT = 10;

export default function Home() {
  const [players, setPlayers] = useState<(PlayerData | null)[]>(Array(PLAYER_COUNT).fill(null));
  const [preloadedPlayers, setPreloadedPlayers] = useState<(PlayerData | null)[]>(Array(PLAYER_COUNT).fill(null));
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [balancing, setBalancing] = useState(false);
  const { toastMsg, showToast } = useToast();
  const { ref: resultRef, copy: copyImage, copying } = useCopyImage();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("balancer_result");
      if (stored) setResult(JSON.parse(stored));
    } catch { /* ignore */ }
    try {
      const storedPlayers = localStorage.getItem("balancer_players");
      if (storedPlayers) {
        const parsed: (PlayerData | null)[] = JSON.parse(storedPlayers);
        setPlayers(parsed);
        setPreloadedPlayers(parsed);
        setCardResetKey((k) => k + 1);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("balancer_players", JSON.stringify(players));
    } catch { /* ignore */ }
  }, [players]);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [cardResetKey, setCardResetKey] = useState(0);
  const bulkCancelRef = useRef(false);

  const readyCount = players.filter(Boolean).length;
  const allReady = readyCount === PLAYER_COUNT;

const handleDataChange = useCallback((index: number, data: PlayerData | null) => {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = data;
      return next;
    });
  }, []);

  // テキストから Riot ID を抽出（参加/退出ログ対応）
  // LoLクライアントは Riot ID に Unicode 双方向制御文字を埋め込み、
  // かつ「名前 #タグ」のように # 前にスペースを挿入するため両方に対応
  const parsedIds = useMemo(() => {
    // U+2066 LRI, U+2067 RLI, U+2068 FSI, U+2069 PDI, U+202A-U+202E 各種埋め込み,
    // U+200B ZWSP, U+FEFF BOM など不可視/双方向制御文字をすべて除去
    const BIDI = /[\u2066-\u2069\u202a-\u202e\u200b\ufeff]/g;
    // # の前後に任意のスペースを許容し、名前・タグを別グループで捕捉
    const RIOT_ID = /([^\s\[\]:#]+)\s*#\s*([A-Za-z0-9]{1,8})/;
    const joined = new Set<string>();
    const left = new Set<string>();
    const order: string[] = [];

    for (const rawLine of bulkText.split("\n")) {
      const line = rawLine.replace(BIDI, "");
      const m = line.match(RIOT_ID);
      if (!m) continue;
      const id = `${m[1]}#${m[2]}`; // スペースを除いた標準形式に正規化

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

    bulkCancelRef.current = false;
    setBulkLoading(true);
    setBulkProgress({ done: 0, total: parsedIds.length });

    const results: (PlayerData | null)[] = Array(PLAYER_COUNT).fill(null);
    const errors: string[] = [];
    let cancelled = false;
    let rateLimited = false;

    // 逐次実行でRiot APIレート制限を回避
    for (let i = 0; i < parsedIds.slice(0, PLAYER_COUNT).length; i++) {
      if (bulkCancelRef.current) { cancelled = true; break; }
      const id = parsedIds[i];
      try {
        const data = await fetchPlayerData(id, i);
        results[i] = data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "取得失敗";
        if (msg === "RATE_LIMIT") { rateLimited = true; break; }
        errors.push(`${id}: ${msg}`);
        results[i] = null;
      }
      setBulkProgress({ done: i + 1, total: parsedIds.length });
    }

    setPreloadedPlayers([...results]);
    setPlayers([...results]);
    setCardResetKey((k) => k + 1);
    setBulkLoading(false);
    setBulkProgress(null);
    setBulkOpen(false);
    setBulkText("");

    if (rateLimited) {
      showToast("API上限に達しました。約2分後に再試行してください");
    } else if (cancelled) {
      showToast("取得をキャンセルしました");
    } else if (errors.length > 0) {
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
      localStorage.setItem("balancer_result", JSON.stringify(data));
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBalancing(false);
    }
  }

  function handleClearAll() {
    const empty = Array(PLAYER_COUNT).fill(null);
    setPlayers(empty);
    setPreloadedPlayers(empty);
    setCardResetKey((k) => k + 1);
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
            <h1 className="text-3xl font-bold tracking-tight">
              TEAM <span className="text-gold">BALANCER</span>
            </h1>
          </div>
          <p className="font-mono text-sm text-ink-muted hidden sm:block">JP1 · RIOT API v5</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-10">

        {/* プレイヤー入力 */}
        <section>
          {/* セクションヘッダー */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-ink-muted uppercase tracking-widest">Players</span>
              <span className="font-mono text-sm text-gold">{readyCount} / {PLAYER_COUNT}</span>
            </div>
            <div className="flex items-center gap-2">
              {readyCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="border border-wire text-ink-muted text-sm px-3 py-1.5 tracking-wide hover:border-crimson hover:text-crimson transition-colors"
                >
                  全クリア
                </button>
              )}
              <button
                onClick={() => setBulkOpen((v) => !v)}
                className="border border-wire text-ink-dim text-sm px-3 py-1.5 tracking-wide hover:border-wire-bright hover:text-ink transition-colors"
              >
                {bulkOpen ? "閉じる" : "一括入力"}
              </button>
            </div>
          </div>

          {/* 一括入力パネル */}
          {bulkOpen && (
            <div className="mb-5 border border-wire bg-surface p-5 flex flex-col gap-4">
              <div>
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest mb-1">Bulk Import</p>
                <p className="text-sm text-ink-dim">
                  ロビーチャットをそのままペーストできます。参加/退出ログから現在の参加者を自動判定します。
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-mono text-xs text-ink-muted uppercase tracking-widest">入力例</p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Player1#JP1がロビーに参加しました\nPlayer2#JP1がロビーに参加しました\nPlayer2#JP1がロビーから退出しました\n\n[All] Player3#JP1: よろしく"}
                  rows={6}
                  className="bg-raised border border-wire text-ink text-sm font-mono px-3 py-2 placeholder-ink-muted focus:outline-none focus:border-wire-bright resize-y w-full"
                />
              </div>

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
                      <span key={id} className="border border-wire-bright text-ink-dim font-mono text-sm px-2 py-0.5">
                        {id}
                      </span>
                    ))}
                    {parsedIds.length > PLAYER_COUNT && (
                      <span className="text-crimson font-mono text-sm px-2 py-0.5">
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
                  <span className="font-mono text-sm text-ink-dim">{bulkProgress.done}/{bulkProgress.total}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkImport}
                  disabled={bulkLoading || parsedIds.length === 0}
                  className="border border-gold text-gold font-mono text-sm uppercase tracking-widest px-4 py-2 hover:bg-gold hover:text-canvas disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {bulkLoading ? "取得中..." : `取得 (${Math.min(parsedIds.length, PLAYER_COUNT)}人)`}
                </button>
                {bulkLoading && (
                  <button
                    onClick={() => { bulkCancelRef.current = true; }}
                    className="border border-wire text-ink-dim font-mono text-sm px-3 py-2 hover:border-crimson hover:text-crimson transition-colors"
                  >
                    キャンセル
                  </button>
                )}
              </div>
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
              <button
                onClick={async () => {
                  const ok = await copyImage();
                  showToast(ok ? "画像をコピーしました" : "コピーに失敗しました（ブラウザ非対応の可能性）");
                }}
                disabled={copying}
                className="font-mono text-xs text-ink-dim border border-wire px-3 py-1 hover:border-wire-bright hover:text-ink disabled:opacity-30 transition-colors"
              >
                {copying ? "..." : "画像コピー"}
              </button>
              <a
                href="/players"
                className="font-mono text-xs text-ink-dim border border-wire px-3 py-1 hover:border-wire-bright hover:text-ink transition-colors"
              >
                スコア詳細 →
              </a>
            </div>
            <div ref={resultRef}>
              <TeamResult
                result={result}
                onRoleChange={handleRoleChange}
                onReconfirm={handleReconfirm}
                onReshuffle={handleReshuffle}
              />
            </div>
          </section>
        )}
      </div>

      {/* トースト */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-wire-bright text-ink px-5 py-3 text-sm font-mono z-50">
          {toastMsg}
        </div>
      )}
    </main>
  );
}
