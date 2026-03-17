import { NextRequest, NextResponse } from "next/server";
import { getPuuid, getRankByPuuid } from "@/lib/riot";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const name = searchParams.get("name");
  const tag = searchParams.get("tag");

  if (!name || !tag) {
    return NextResponse.json({ error: "name and tag are required" }, { status: 400 });
  }

  try {
    const puuid = await getPuuid(name, tag);
    const rankInfo = await getRankByPuuid(puuid);

    return NextResponse.json({
      puuid,
      summonerName: name,
      tier: rankInfo?.tier ?? "SILVER",
      rank: rankInfo?.rank ?? "I",
      lp: rankInfo?.lp ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    let status = 500;
    if (message.includes("見つかりません")) status = 404;
    else if (message.includes("無効または期限切れ")) status = 403;
    else if (message.includes("rate limit") || message.includes("レート制限")) status = 429;
    return NextResponse.json({ error: message }, { status });
  }
}
