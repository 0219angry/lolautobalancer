import { NextRequest, NextResponse } from "next/server";
import { balanceTeams } from "@/lib/balance";
import type { BalanceRequest } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body: BalanceRequest = await req.json();

    if (!Array.isArray(body.players) || body.players.length !== 10) {
      return NextResponse.json({ error: "Exactly 10 players required" }, { status: 400 });
    }

    const result = balanceTeams(body.players);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
