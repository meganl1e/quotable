import { NextRequest, NextResponse } from "next/server";

import {
  getDatasetHealth,
  getMessageContext,
} from "@/lib/game/messages";

const MAX_WINDOW = 10;
const DEFAULT_WINDOW = 3;

export async function GET(request: NextRequest) {
  const healthError = getDatasetHealth();
  if (healthError) {
    return NextResponse.json(
      { error: healthError ?? "Game is not configured correctly." },
      { status: 400 },
    );
  }

  const roundId = request.nextUrl.searchParams.get("roundId");
  if (!roundId) {
    return NextResponse.json({ error: "roundId is required." }, { status: 400 });
  }

  const rawWindow = parseInt(
    request.nextUrl.searchParams.get("window") ?? String(DEFAULT_WINDOW),
    10,
  );
  const windowSize = Number.isNaN(rawWindow)
    ? DEFAULT_WINDOW
    : Math.min(Math.max(rawWindow, 1), MAX_WINDOW);

  const context = getMessageContext(roundId, windowSize);
  if (!context) {
    return NextResponse.json({ error: "Round not found." }, { status: 404 });
  }

  return NextResponse.json({ context });
}
