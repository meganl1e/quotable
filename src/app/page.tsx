"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Round = {
  id: string;
  text: string;
};

type FeedbackState = "idle" | "correct" | "incorrect";

type RoundResponse = {
  round: Round;
  senderOptions: string[];
};

type GuessResponse = {
  correct: boolean;
  correctSender: string;
  timestamp: string;
};

type ContextMessage = {
  sender: string;
  text: string;
  timestamp: string;
  isTarget: boolean;
};

type ContextResponse = {
  context: ContextMessage[];
};

const formatMessageTimestamp = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

// Consistent per-sender color assignment by index in senderOptions array
const SENDER_COLORS = [
  {
    idle: "rounded-full border border-[#5AC8FA] text-[#0A84FF] hover:bg-[#0A84FF]/5 active:scale-95",
    correct: "rounded-full border border-green-400 bg-green-50 text-green-600",
    wrong: "rounded-full border border-red-300 bg-red-50 text-red-400",
    dim: "rounded-full border border-gray-200 text-gray-300",
  },
  {
    idle: "rounded-full border border-[#FFB3C1] text-[#FF375F] hover:bg-[#FF375F]/5 active:scale-95",
    correct: "rounded-full border border-green-400 bg-green-50 text-green-600",
    wrong: "rounded-full border border-red-300 bg-red-50 text-red-400",
    dim: "rounded-full border border-gray-200 text-gray-300",
  },
] as const;

const SESSION_DOT_COUNT = 10;

export default function Home() {
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sessionGuesses, setSessionGuesses] = useState(0);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [revealVisible, setRevealVisible] = useState(false);
  const [isLoadingRound, setIsLoadingRound] = useState(true);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [senderOptions, setSenderOptions] = useState<string[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [revealedCorrectSender, setRevealedCorrectSender] = useState<string | null>(null);
  const [revealedTimestamp, setRevealedTimestamp] = useState<string | null>(null);
  const [scorePulse, setScorePulse] = useState(false);
  const [streakPulse, setStreakPulse] = useState(false);
  const [contextMessages, setContextMessages] = useState<ContextMessage[] | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const prevScoreRef = useRef(0);
  const prevStreakRef = useRef(0);

  const hasValidSetup = senderOptions.length === 2 && currentRound !== null;

  useEffect(() => {
    if (score > prevScoreRef.current) {
      setScorePulse(true);
      const t = window.setTimeout(() => setScorePulse(false), 350);
      prevScoreRef.current = score;
      return () => window.clearTimeout(t);
    }
    prevScoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (streak > prevStreakRef.current) {
      setStreakPulse(true);
      const t = window.setTimeout(() => setStreakPulse(false), 350);
      prevStreakRef.current = streak;
      return () => window.clearTimeout(t);
    }
    prevStreakRef.current = streak;
  }, [streak]);

  // Tiny delay so the reveal bubble mounts before its CSS transition fires
  useEffect(() => {
    const t = window.setTimeout(
      () => setRevealVisible(feedbackState !== "idle"),
      feedbackState !== "idle" ? 30 : 0,
    );
    return () => window.clearTimeout(t);
  }, [feedbackState]);

  const loadRound = useCallback(async (excludeId?: string) => {
    setIsLoadingRound(true);
    setSetupError(null);

    try {
      const query = excludeId ? `?excludeId=${encodeURIComponent(excludeId)}` : "";
      const response = await fetch(`/api/game${query}`, { method: "GET" });
      const data = (await response.json()) as RoundResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load a game round.");
      }

      setCurrentRound(data.round);
      setSenderOptions(data.senderOptions.slice(0, 2));
      setFeedbackState("idle");
      setSelectedSender(null);
      setRevealedCorrectSender(null);
      setRevealedTimestamp(null);
      setContextMessages(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load the game right now.";
      setSetupError(message);
      setCurrentRound(null);
      setSenderOptions([]);
    } finally {
      setIsLoadingRound(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadRound(), 0);
    return () => window.clearTimeout(t);
  }, [loadRound]);

  const handleGuess = async (senderName: string) => {
    if (!currentRound || feedbackState !== "idle" || isSubmittingGuess) return;
    setSelectedSender(senderName);
    setIsSubmittingGuess(true);

    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: currentRound.id, guessedSender: senderName }),
      });

      const data = (await response.json()) as GuessResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not submit your guess.");
      }

      setSessionGuesses((prev) => prev + 1);

      if (data.correct) {
        setFeedbackState("correct");
        setScore((prev) => prev + 1);
        setStreak((prev) => prev + 1);
        setRevealedCorrectSender(data.correctSender);
        setRevealedTimestamp(data.timestamp);
      } else {
        setFeedbackState("incorrect");
        setStreak(0);
        setRevealedCorrectSender(data.correctSender);
        setRevealedTimestamp(data.timestamp);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not submit your guess.";
      setSetupError(message);
      setFeedbackState("idle");
      setSelectedSender(null);
      setRevealedCorrectSender(null);
      setRevealedTimestamp(null);
    } finally {
      setIsSubmittingGuess(false);
    }
  };

  const handleShowContext = async () => {
    if (!currentRound || isLoadingContext || contextMessages !== null) return;
    setIsLoadingContext(true);

    try {
      const response = await fetch(
        `/api/game/context?roundId=${encodeURIComponent(currentRound.id)}`,
      );
      const data = (await response.json()) as ContextResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load context.");
      setContextMessages(data.context);
    } catch {
      // Silently ignore — context is a best-effort enhancement
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleNext = async () => {
    if (!currentRound) return;
    await loadRound(currentRound.id);
  };

  const filledDots =
    sessionGuesses === 0
      ? 0
      : sessionGuesses % SESSION_DOT_COUNT === 0
        ? SESSION_DOT_COUNT
        : sessionGuesses % SESSION_DOT_COUNT;

  const getButtonClasses = (senderName: string, index: number): string => {
    const colors = SENDER_COLORS[index % 2];
    const showAnsweredState = feedbackState !== "idle";
    const isThisCorrect = revealedCorrectSender === senderName;
    const isSelected = selectedSender === senderName;

    if (!showAnsweredState) return colors.idle;
    if (isThisCorrect) return colors.correct;
    if (isSelected && feedbackState === "incorrect") return `animate-shake-x ${colors.wrong}`;
    return colors.dim;
  };

  const revealText =
    feedbackState === "correct"
      ? `Yep, that was ${revealedCorrectSender ?? "them"}! ✅`
      : `Nope, that was actually ${revealedCorrectSender ?? "Unknown"} ❌`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-4 py-12">
      <div className="flex min-h-[520px] w-full max-w-[360px] flex-col rounded-[2.5rem] border border-gray-200 bg-[#FAF7F2] shadow-sm">
        <div className="flex flex-1 flex-col gap-5 px-6 pb-8 pt-8">

          {/* Pill stat badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-5 py-2 text-sm text-gray-500">
              <span>
                Score:{" "}
                <span
                  className={`font-semibold text-gray-700 inline-block ${scorePulse ? "animate-hud-pulse" : ""}`}
                >
                  {score}
                </span>
              </span>
              <span className="text-gray-300">·</span>
              <span>
                Streak:{" "}
                <span
                  className={`font-semibold text-gray-700 inline-block ${streakPulse ? "animate-hud-pulse" : ""}`}
                >
                  {streak}
                </span>
              </span>
            </div>
          </div>

          {isLoadingRound ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-gray-400">Loading...</p>
            </div>
          ) : !hasValidSetup ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-gray-600">Setup issue</p>
              <p className="text-xs text-gray-400">
                {setupError ?? "Make sure filtered messages and senders are available."}
              </p>
            </div>
          ) : (
            <>
              {/* Chat bubbles */}
              <div className="flex min-h-[200px] flex-col gap-3 pt-2">
                {/* Context messages — before the target */}
                {contextMessages !== null && (
                  <div className="flex flex-col gap-2 border-b border-gray-100 pb-3">
                    {contextMessages
                      .filter((m) => !m.isTarget)
                      .slice(
                        0,
                        contextMessages.findIndex((m) => m.isTarget),
                      )
                      .map((m, i) => {
                        const isFirst = senderOptions[0] === m.sender;
                        return (
                          <div
                            key={`before-${i}`}
                            className={`flex w-full ${isFirst ? "justify-end pr-1" : "justify-start pl-1"}`}
                          >
                            <div className="max-w-[78%]">
                              <div
                                className={`px-3 py-2 text-[13px] leading-snug ${
                                  isFirst ? "bubble-sent" : "bubble-received"
                                }`}
                              >
                                {m.text}
                              </div>
                              <p
                                className={`mt-0.5 text-[10px] text-gray-400 ${isFirst ? "text-right pr-1" : "pl-1"}`}
                              >
                                {m.sender.split(" ")[0]}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Sent bubble — right-aligned, blue */}
                <div
                  className={`flex w-full flex-col items-end pr-1 ${contextMessages !== null ? "ring-2 ring-blue-300 ring-offset-2 rounded-2xl" : ""}`}
                >
                  <div
                    key={currentRound.id}
                    className="animate-bubble-pop-right max-w-[82%]"
                  >
                    <div className="bubble-sent px-4 py-2.5 text-[15px] leading-relaxed">
                      {currentRound.text}
                    </div>
                  </div>
                  {feedbackState !== "idle" && revealedTimestamp && (
                    <p
                      className={`mt-1.5 pr-1 text-[11px] text-gray-400 transition-all duration-300 ease-out ${
                        revealVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                      }`}
                    >
                      {formatMessageTimestamp(revealedTimestamp)}
                    </p>
                  )}
                </div>

                {/* Reveal bubble — left-aligned, gray, pops in */}
                {feedbackState !== "idle" && (
                  <div className="flex w-full justify-start pl-1">
                    <div className="animate-bubble-pop-left max-w-[82%]">
                      <div className="bubble-received px-4 py-2.5 text-[15px] leading-relaxed">
                        {revealText}
                      </div>
                    </div>
                  </div>
                )}

                {/* Context messages — after the target */}
                {contextMessages !== null && (
                  <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                    {contextMessages
                      .slice(contextMessages.findIndex((m) => m.isTarget) + 1)
                      .map((m, i) => {
                        const isFirst = senderOptions[0] === m.sender;
                        return (
                          <div
                            key={`after-${i}`}
                            className={`flex w-full ${isFirst ? "justify-end pr-1" : "justify-start pl-1"}`}
                          >
                            <div className="max-w-[78%]">
                              <div
                                className={`px-3 py-2 text-[13px] leading-snug ${
                                  isFirst ? "bubble-sent" : "bubble-received"
                                }`}
                              >
                                {m.text}
                              </div>
                              <p
                                className={`mt-0.5 text-[10px] text-gray-400 ${isFirst ? "text-right pr-1" : "pl-1"}`}
                              >
                                {m.sender.split(" ")[0]}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Guess buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                {senderOptions.map((senderName, index) => (
                  <button
                    key={senderName}
                    type="button"
                    onClick={() => void handleGuess(senderName)}
                    disabled={feedbackState !== "idle" || isSubmittingGuess}
                    className={`px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed ${getButtonClasses(senderName, index)}`}
                  >
                    {senderName}
                  </button>
                ))}
              </div>

              {/* Next + Show context buttons — fade in with reveal bubble */}
              <div
                className={`flex flex-col items-center gap-2 transition-all duration-300 ease-out ${
                  feedbackState !== "idle"
                    ? revealVisible
                      ? "pointer-events-auto translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-2 opacity-0"
                    : "pointer-events-none opacity-0"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  className="rounded-full bg-gray-800 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 active:scale-95"
                >
                  Next
                </button>
                {contextMessages === null && (
                  <button
                    type="button"
                    onClick={() => void handleShowContext()}
                    disabled={isLoadingContext}
                    className="text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    {isLoadingContext ? "Loading context…" : "Show context"}
                  </button>
                )}
              </div>
            </>
          )}

          {/* Session dot progress */}
          <div className="flex justify-center gap-1.5 pt-1">
            {Array.from({ length: SESSION_DOT_COUNT }).map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                  index < filledDots ? "bg-gray-400" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
