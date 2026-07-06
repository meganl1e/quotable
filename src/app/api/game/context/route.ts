import { NextRequest, NextResponse } from "next/server";

import {
  CONTEXT_PAGE_SIZE,
  getDatasetHealth,
  getMessageContext,
  getMessageContextPage,
  INITIAL_CONTEXT_AFTER,
  INITIAL_CONTEXT_BEFORE,
} from "@/lib/game/messages";

const MAX_WINDOW = 10;
const DEFAULT_WINDOW = 3;

const parseOptionalInt = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

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

  const params = request.nextUrl.searchParams;
  const startIndex = parseOptionalInt(params.get("startIndex"));
  const endIndex = parseOptionalInt(params.get("endIndex"));
  const before = parseOptionalInt(params.get("before"));
  const after = parseOptionalInt(params.get("after"));
  const legacyWindow = parseOptionalInt(params.get("window"));

  // Legacy: ?window=N returns flat context array (backward compat)
  if (legacyWindow !== undefined && startIndex === undefined && endIndex === undefined) {
    const windowSize = Math.min(Math.max(legacyWindow, 1), MAX_WINDOW);
    const context = getMessageContext(roundId, windowSize);
    if (!context) {
      return NextResponse.json({ error: "Round not found." }, { status: 404 });
    }
    return NextResponse.json({ context });
  }

  const page = getMessageContextPage(roundId, {
    before: before ?? (endIndex !== undefined ? CONTEXT_PAGE_SIZE : INITIAL_CONTEXT_BEFORE),
    after: after ?? (startIndex !== undefined ? CONTEXT_PAGE_SIZE : INITIAL_CONTEXT_AFTER),
    startIndex,
    endIndex,
  });

  if (!page) {
    return NextResponse.json({ error: "Round not found." }, { status: 404 });
  }

  if (page.context.length === 0 && (startIndex !== undefined || endIndex !== undefined)) {
    return NextResponse.json({ error: "No more messages in that direction." }, { status: 404 });
  }

  return NextResponse.json(page);
}
