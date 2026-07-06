import { NextRequest, NextResponse } from "next/server";

import {
  checkGuess,
  getDatasetHealth,
  getRandomRound,
  getSenderOptions,
} from "@/lib/game/messages";

type GuessBody = {
  roundId?: string;
  guessedSender?: string;
};

const getConfigErrorResponse = () =>
  NextResponse.json(
    { error: getDatasetHealth() ?? "Game is not configured correctly." },
    { status: 400 },
  );

export async function GET(request: NextRequest) {
  const healthError = getDatasetHealth();
  if (healthError) {
    return getConfigErrorResponse();
  }

  const excludeId = request.nextUrl.searchParams.get("excludeId") ?? undefined;
  const round = getRandomRound(excludeId);

  if (!round) {
    return NextResponse.json({ error: "Could not load a game round." }, { status: 500 });
  }

  return NextResponse.json({
    round,
    senderOptions: getSenderOptions(),
  });
}

export async function POST(request: NextRequest) {
  const healthError = getDatasetHealth();
  if (healthError) {
    return getConfigErrorResponse();
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

  const result = checkGuess(roundId, guessedSender);
  if (!result) {
    return NextResponse.json({ error: "Round not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
