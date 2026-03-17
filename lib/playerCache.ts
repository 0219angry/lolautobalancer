import type { PlayerData } from "@/types";

const CACHE_KEY = "lol_player_cache";
const TTL_MS = 60 * 60 * 1000; // 1時間

interface CacheEntry {
  data: PlayerData;
  at: number;
}

function loadStore(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getCachedPlayer(riotId: string): PlayerData | null {
  try {
    const entry = loadStore()[riotId.toLowerCase()];
    if (!entry) return null;
    if (Date.now() - entry.at > TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedPlayer(riotId: string, data: PlayerData): void {
  try {
    const store = loadStore();
    store[riotId.toLowerCase()] = { data, at: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

/** キャッシュの残り有効時間を分で返す（キャッシュなし → null） */
export function getCacheAgeMin(riotId: string): number | null {
  try {
    const entry = loadStore()[riotId.toLowerCase()];
    if (!entry) return null;
    const elapsed = Date.now() - entry.at;
    if (elapsed > TTL_MS) return null;
    return Math.floor(elapsed / 60000);
  } catch {
    return null;
  }
}

export function clearPlayerCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}
