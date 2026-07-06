"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

type Round = {
  id: string;
  text: string;
};

type FeedbackState = "idle" | "correct" | "incorrect";

type PlayedRound = {
  round: Round;
  result: "correct" | "incorrect";
  correctSender: string;
  timestamp: string;
};

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
  rawIndex: number;
  sender: string;
  text: string;
  timestamp: string;
  isTarget: boolean;
};

type ContextBounds = {
  startIndex: number;
  endIndex: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

type ContextPageResponse = {
  context: ContextMessage[];
  bounds: ContextBounds;
};

const INITIAL_CONTEXT_BEFORE = 8;
const INITIAL_CONTEXT_AFTER = 8;
const CONTEXT_PAGE_SIZE = 10;

const mergeContextMessages = (
  existing: ContextMessage[],
  incoming: ContextMessage[],
): ContextMessage[] => {
  const byIndex = new Map<number, ContextMessage>();
  for (const message of [...existing, ...incoming]) {
    byIndex.set(message.rawIndex, message);
  }
  return [...byIndex.values()].sort((a, b) => a.rawIndex - b.rawIndex);
};

type ContextMessageGroup = {
  sender: string;
  messages: ContextMessage[];
};

const groupConsecutiveBySender = (messages: ContextMessage[]): ContextMessageGroup[] => {
  const groups: ContextMessageGroup[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (last && last.sender === message.sender) {
      last.messages.push(message);
    } else {
      groups.push({ sender: message.sender, messages: [message] });
    }
  }
  return groups;
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

const CONTEXT_LOAD_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";

const ContextChevron = ({ direction }: { direction: "up" | "down" }) => (
  <svg
    aria-hidden
    className="h-3 w-3 shrink-0 opacity-60"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {direction === "up" ? (
      <path d="M2.5 8 6 4.5 9.5 8" />
    ) : (
      <path d="M2.5 4 6 7.5 9.5 4" />
    )}
  </svg>
);

const getFirstName = (fullName: string): string => fullName.split(" ")[0] ?? fullName;

const getRevealText = (result: "correct" | "incorrect", correctSender: string): string =>
  result === "correct"
    ? `Yep, that was ${getFirstName(correctSender)}! ✅`
    : `Nope, that was actually ${getFirstName(correctSender)} ❌`;

const isBlueSender = (sender: string, blueSender: string | null): boolean =>
  blueSender !== null && sender === blueSender;

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
  const [contextBounds, setContextBounds] = useState<ContextBounds | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [isLoadingLater, setIsLoadingLater] = useState(false);
  const [playedRounds, setPlayedRounds] = useState<PlayedRound[]>([]);

  const prevScoreRef = useRef(0);
  const prevStreakRef = useRef(0);
  const contextScrollRef = useRef<HTMLDivElement>(null);
  const targetBubbleRef = useRef<HTMLDivElement>(null);
  const shouldAnchorTargetRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // Scroll to bottom when the answer reveal bubble appears
  useEffect(() => {
    if (feedbackState === "idle") return;
    const t = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [feedbackState]);

  // Scroll to bottom instantly when a new round finishes loading after the first round
  useEffect(() => {
    if (isLoadingRound || playedRounds.length === 0) return;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingRound]);

  // Scroll quoted message into view when context first opens
  useEffect(() => {
    if (contextMessages === null || !shouldAnchorTargetRef.current) return;
    shouldAnchorTargetRef.current = false;
    const t = window.setTimeout(() => {
      targetBubbleRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [contextMessages]);

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
      setContextBounds(null);
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
        `/api/game/context?roundId=${encodeURIComponent(currentRound.id)}&before=${INITIAL_CONTEXT_BEFORE}&after=${INITIAL_CONTEXT_AFTER}`,
      );
      const data = (await response.json()) as ContextPageResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load context.");
      shouldAnchorTargetRef.current = true;
      setContextMessages(data.context);
      setContextBounds(data.bounds);
    } catch {
      // Silently ignore — context is a best-effort enhancement
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleHideContext = () => {
    setContextMessages(null);
    setContextBounds(null);
    if (contextScrollRef.current) {
      contextScrollRef.current.scrollTop = 0;
    }
  };

  const handleLoadEarlier = async () => {
    if (!currentRound || !contextBounds || isLoadingEarlier || !contextBounds.hasMoreBefore) return;

    const scrollEl = contextScrollRef.current;
    const prevScrollHeight = scrollEl?.scrollHeight ?? 0;
    setIsLoadingEarlier(true);

    try {
      const endIndex = contextBounds.startIndex - 1;
      const response = await fetch(
        `/api/game/context?roundId=${encodeURIComponent(currentRound.id)}&before=${CONTEXT_PAGE_SIZE}&endIndex=${endIndex}`,
      );
      const data = (await response.json()) as ContextPageResponse & { error?: string };
      if (!response.ok) {
        setContextBounds((prev) =>
          prev ? { ...prev, hasMoreBefore: false } : prev,
        );
        return;
      }

      setContextMessages((prev) => mergeContextMessages(prev ?? [], data.context));
      setContextBounds((prev) =>
        prev
          ? {
              startIndex: data.bounds.startIndex,
              endIndex: prev.endIndex,
              hasMoreBefore: data.bounds.hasMoreBefore,
              hasMoreAfter: prev.hasMoreAfter,
            }
          : data.bounds,
      );

      requestAnimationFrame(() => {
        if (scrollEl) {
          scrollEl.scrollTop += scrollEl.scrollHeight - prevScrollHeight;
        }
      });
    } finally {
      setIsLoadingEarlier(false);
    }
  };

  const handleLoadLater = async () => {
    if (!currentRound || !contextBounds || isLoadingLater || !contextBounds.hasMoreAfter) return;
    setIsLoadingLater(true);

    try {
      const response = await fetch(
        `/api/game/context?roundId=${encodeURIComponent(currentRound.id)}&after=${CONTEXT_PAGE_SIZE}&startIndex=${contextBounds.endIndex}`,
      );
      const data = (await response.json()) as ContextPageResponse & { error?: string };
      if (!response.ok) {
        setContextBounds((prev) =>
          prev ? { ...prev, hasMoreAfter: false } : prev,
        );
        return;
      }

      setContextMessages((prev) => mergeContextMessages(prev ?? [], data.context));
      setContextBounds((prev) =>
        prev
          ? {
              startIndex: prev.startIndex,
              endIndex: data.bounds.endIndex,
              hasMoreBefore: prev.hasMoreBefore,
              hasMoreAfter: data.bounds.hasMoreAfter,
            }
          : data.bounds,
      );
    } finally {
      setIsLoadingLater(false);
    }
  };

  const handleNext = async () => {
    if (!currentRound || feedbackState === "idle") return;
    setPlayedRounds((prev) => [
      ...prev,
      {
        round: currentRound,
        result: feedbackState,
        correctSender: revealedCorrectSender ?? "",
        timestamp: revealedTimestamp ?? "",
      },
    ]);
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

  const revealText = feedbackState !== "idle"
    ? getRevealText(feedbackState, revealedCorrectSender ?? "")
    : "";

  const renderBubbleContent = (
    key: string,
    {
      text,
      isBlue,
      isTarget = false,
      showTail = true,
      isStackTop = false,
      timestamp,
      showTimestamp = false,
      bubbleRef,
    }: {
      text: string;
      isBlue: boolean;
      isTarget?: boolean;
      showTail?: boolean;
      isStackTop?: boolean;
      timestamp?: string | null;
      showTimestamp?: boolean;
      bubbleRef?: RefObject<HTMLDivElement | null>;
    },
  ) => (
    <div key={key} className={`flex flex-col ${isBlue ? "items-end" : "items-start"}`}>
      <div
        ref={isTarget ? bubbleRef : undefined}
        className={`px-4 py-2 text-[13px] leading-snug ${isBlue ? "bubble-sent" : "bubble-received"} ${!showTail ? "bubble-stack" : ""} ${isStackTop ? "bubble-stack-top" : ""} ${isTarget ? "bubble-target-highlight" : ""}`}
      >
        {text}
      </div>
      {showTimestamp && timestamp && (
        <p
          className={`mt-1.5 text-[11px] font-medium text-gray-500 ${isBlue ? "pr-1 text-right" : "pl-1"}`}
        >
          {formatMessageTimestamp(timestamp)}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-4 py-8">
      <div className="flex h-[min(844px,calc(100svh-4rem))] w-full max-w-[390px] flex-col overflow-hidden rounded-[2.5rem] border border-gray-200 bg-[#FAF7F2] shadow-sm">
        {/* Score badge */}
        <div className="flex shrink-0 justify-center px-6 pb-3 pt-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-5 py-2 text-sm text-gray-500">
            <span>
              Score:{" "}
              <span
                className={`inline-block font-semibold text-gray-700 ${scorePulse ? "animate-hud-pulse" : ""}`}
              >
                {score}
              </span>
            </span>
            <span className="text-gray-300">·</span>
            <span>
              Streak:{" "}
              <span
                className={`inline-block font-semibold text-gray-700 ${streakPulse ? "animate-hud-pulse" : ""}`}
              >
                {streak}
              </span>
            </span>
          </div>
        </div>

        {/* Scrollable messages */}
        <div
          ref={contextScrollRef}
          className="chat-scroll min-h-0 flex-1 overflow-y-auto px-6"
        >
          {isLoadingRound ? (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <p className="text-sm text-gray-400">Loading...</p>
            </div>
          ) : !hasValidSetup ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-gray-600">Setup issue</p>
              <p className="text-xs text-gray-400">
                {setupError ?? "Make sure filtered messages and senders are available."}
              </p>
            </div>
          ) : contextMessages !== null ? (
            <div className="flex flex-col gap-2.5 pb-2">
              {contextBounds?.hasMoreBefore && (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={() => void handleLoadEarlier()}
                    disabled={isLoadingEarlier}
                    className={CONTEXT_LOAD_BUTTON_CLASSES}
                  >
                    <ContextChevron direction="up" />
                    {isLoadingEarlier ? "Loading…" : "Load earlier"}
                  </button>
                </div>
              )}

              {groupConsecutiveBySender(contextMessages).map((group, groupIndex) => {
                const isBlue = isBlueSender(group.sender, revealedCorrectSender);
                return (
                  <div
                    key={`group-${groupIndex}`}
                    className={`flex w-full flex-col ${isBlue ? "items-end pr-2" : "items-start pl-2"}`}
                  >
                    <div
                      className={`flex max-w-[78%] flex-col gap-[2px] ${isBlue ? "items-end" : "items-start"}`}
                    >
                      <p
                        className={`mb-0.5 text-[11px] font-semibold text-gray-600 ${isBlue ? "pr-1 text-right" : "pl-1"}`}
                      >
                        {getFirstName(group.sender)}
                      </p>
                      {group.messages.map((m, i) =>
                        renderBubbleContent(`ctx-${groupIndex}-${i}`, {
                          text: m.isTarget ? currentRound!.text : m.text,
                          isBlue,
                          isTarget: m.isTarget,
                          showTail: i === group.messages.length - 1,
                          isStackTop: i > 0,
                          timestamp: m.isTarget ? revealedTimestamp : undefined,
                          showTimestamp: m.isTarget,
                          bubbleRef: m.isTarget ? targetBubbleRef : undefined,
                        }),
                      )}
                    </div>
                  </div>
                );
              })}

              {contextBounds?.hasMoreAfter && (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={() => void handleLoadLater()}
                    disabled={isLoadingLater}
                    className={CONTEXT_LOAD_BUTTON_CLASSES}
                  >
                    {isLoadingLater ? "Loading…" : "Load later"}
                    <ContextChevron direction="down" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-2 pb-2">
              {/* History — past answered rounds */}
              {playedRounds.map((pr, i) => (
                <div key={pr.round.id} className="flex flex-col gap-3">
                  <div className="flex w-full flex-col items-end pr-1 opacity-70">
                    <div className="max-w-[82%]">
                      <div className="bubble-sent px-4 py-2.5 text-[15px] leading-relaxed">
                        {pr.round.text}
                      </div>
                    </div>
                    {pr.timestamp && (
                      <p className="mt-1.5 pr-1 text-[11px] text-gray-400">
                        {formatMessageTimestamp(pr.timestamp)}
                      </p>
                    )}
                  </div>
                  <div className="flex w-full justify-start pl-1 opacity-70">
                    <div className="max-w-[82%]">
                      <div className="bubble-received px-4 py-2.5 text-[15px] leading-relaxed">
                        {getRevealText(pr.result, pr.correctSender)}
                      </div>
                    </div>
                  </div>
                  {/* Round divider */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-[11px] text-gray-400">Round {i + 2}</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                </div>
              ))}

              {/* Active round */}
              <div className="flex w-full flex-col items-end pr-1">
                <div key={currentRound!.id} className="animate-bubble-pop-right max-w-[82%]">
                  <div className="bubble-sent px-4 py-2.5 text-[15px] leading-relaxed">
                    {currentRound!.text}
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

              {feedbackState !== "idle" && (
                <div className="flex w-full justify-start pl-1">
                  <div className="animate-bubble-pop-left max-w-[82%]">
                    <div className="bubble-received px-4 py-2.5 text-[15px] leading-relaxed">
                      {revealText}
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Controls */}
        {hasValidSetup && !isLoadingRound && (
          <div className="flex shrink-0 flex-col gap-5 px-6 pb-8 pt-4">
            <div className="grid grid-cols-2 gap-2.5">
              {senderOptions.map((senderName, index) => (
                <button
                  key={senderName}
                  type="button"
                  onClick={() => void handleGuess(senderName)}
                  disabled={feedbackState !== "idle" || isSubmittingGuess}
                  className={`px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed ${getButtonClasses(senderName, index)}`}
                >
                  {getFirstName(senderName)}
                </button>
              ))}
            </div>

            <div
              className={`flex flex-col items-center gap-2 transition-all duration-300 ease-out ${
                feedbackState !== "idle"
                  ? revealVisible
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-2 opacity-0"
                  : "pointer-events-none opacity-0"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {contextMessages === null ? (
                  <button
                    type="button"
                    onClick={() => void handleShowContext()}
                    disabled={isLoadingContext}
                    className="rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoadingContext ? "Loading…" : "View context"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleHideContext}
                    className="rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95"
                  >
                    Back to quote
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  className="rounded-full bg-gray-800 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 active:scale-95"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="flex justify-center gap-1.5">
                {Array.from({ length: SESSION_DOT_COUNT }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                      index < filledDots ? "bg-gray-400" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              {sessionGuesses > 0 && (
                <p className="text-[10px] text-gray-400">
                  {filledDots} of {SESSION_DOT_COUNT} this session
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
