import { NextRequest, NextResponse } from "next/server";
import { getPuuid, getSummonerByPuuid, getRankBySummonerId } from "@/lib/riot";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const name = searchParams.get("name");
  const tag = searchParams.get("tag");

  if (!name || !tag) {
    return NextResponse.json({ error: "name and tag are required" }, { status: 400 });
  }

  try {
    const puuid = await getPuuid(name, tag);
    const summoner = await getSummonerByPuuid(puuid);
    const rankInfo = await getRankBySummonerId(summoner.id);

    return NextResponse.json({
      puuid,
      summonerName: summoner.name,
      tier: rankInfo?.tier ?? "SILVER",
      rank: rankInfo?.rank ?? "I",
      lp: rankInfo?.lp ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : message.includes("rate limit") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
