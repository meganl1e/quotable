import { NextRequest, NextResponse } from "next/server";

import {
  checkGuess,
  getDatasetHealth,
  getRandomRound,
  getSenderOptions,
  type DatasetMode,
} from "@/lib/game/messages";

type GuessBody = {
  roundId?: string;
  guessedSender?: string;
};

// demo-prod branch: always use sample mode regardless of query param.
const parseMode = (): DatasetMode => "sample";

const getConfigErrorResponse = (mode: DatasetMode) =>
  NextResponse.json(
    { error: getDatasetHealth(mode) ?? "Game is not configured correctly." },
    { status: 400 },
  );

export async function GET(request: NextRequest) {
  const mode = parseMode();
  const healthError = getDatasetHealth(mode);
  if (healthError) {
    return getConfigErrorResponse(mode);
  }

  const excludeId = request.nextUrl.searchParams.get("excludeId") ?? undefined;
  const round = getRandomRound(excludeId, mode);

  if (!round) {
    return NextResponse.json({ error: "Could not load a game round." }, { status: 500 });
  }

  return NextResponse.json({
    round,
    senderOptions: getSenderOptions(mode),
  });
}

export async function POST(request: NextRequest) {
  const mode = parseMode();
  const healthError = getDatasetHealth(mode);
  if (healthError) {
    return getConfigErrorResponse(mode);
  }

  let body: GuessBody;
  try {
    body = (await request.json()) as GuessBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roundId = body.roundId?.trim();
  const guessedSender = body.guessedSender?.trim();

  if (!roundId || !guessedSender) {
    return NextResponse.json(
      { error: "roundId and guessedSender are required." },
      { status: 400 },
    );
  }

  const result = checkGuess(roundId, guessedSender, mode);
  if (!result) {
    return NextResponse.json({ error: "Round not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
