import { NextRequest, NextResponse } from "next/server";
import { analyzeMatches } from "@/lib/riot";

const MATCH_COUNT_LIMIT = 5; // Personal API上限対応（一時的）

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const puuid = searchParams.get("puuid");
  const count = Math.min(parseInt(searchParams.get("count") ?? `${MATCH_COUNT_LIMIT}`, 10), MATCH_COUNT_LIMIT);

  if (!puuid) {
    return NextResponse.json({ error: "puuid is required" }, { status: 400 });
  }

  try {
    const result = await analyzeMatches(puuid, count);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("rate limit") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
