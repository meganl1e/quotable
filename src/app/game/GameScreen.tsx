"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useGameSettings } from "@/lib/gameSettings";

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

const SESSION_DOT_COUNT = 10;

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

const buildApiUrl = (path: string, params: Record<string, string | number | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string | number][];
  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  return `${path}?${qs}`;
};

type GameScreenProps = {
  mode?: "main" | "sample";
};

export function GameScreen({ mode: modeProp }: GameScreenProps = {}) {
  const searchParams = useSearchParams();
  const mode = modeProp ?? (searchParams.get("mode") === "sample" ? "sample" : "main");
  const { effectiveTheme, personOneButtonTone, personTwoButtonTone, phoneBackgroundTone } = useGameSettings();
  const isDark = effectiveTheme === "dark";

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
      const targetBubble = contextScrollRef.current?.querySelector<HTMLElement>("[data-target-bubble='true']");
      targetBubble?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [contextMessages]);

  const loadRound = useCallback(async (excludeId?: string) => {
    setIsLoadingRound(true);
    setSetupError(null);

    try {
      const url = buildApiUrl("/api/game", { excludeId, mode });
      const response = await fetch(url, { method: "GET" });
      const data = (await response.json()) as RoundResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load a game round.");
      }

      setCurrentRound(data.round);
      setSenderOptions(data.senderOptions.slice(0, 2));
      setFeedbackState("idle");
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
  }, [mode]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadRound(), 0);
    return () => window.clearTimeout(t);
  }, [loadRound]);

  const handleGuess = async (senderName: string) => {
    if (!currentRound || feedbackState !== "idle" || isSubmittingGuess) return;
    setIsSubmittingGuess(true);

    try {
      const response = await fetch(buildApiUrl("/api/game", { mode }), {
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
      const url = buildApiUrl("/api/game/context", {
        roundId: currentRound.id,
        before: INITIAL_CONTEXT_BEFORE,
        after: INITIAL_CONTEXT_AFTER,
        mode,
      });
      const response = await fetch(url);
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
      const url = buildApiUrl("/api/game/context", {
        roundId: currentRound.id,
        before: CONTEXT_PAGE_SIZE,
        endIndex,
        mode,
      });
      const response = await fetch(url);
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
      const url = buildApiUrl("/api/game/context", {
        roundId: currentRound.id,
        after: CONTEXT_PAGE_SIZE,
        startIndex: contextBounds.endIndex,
        mode,
      });
      const response = await fetch(url);
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

  const getSenderButtonStyle = (index: number) => {
    const tone = index % 2 === 0 ? personOneButtonTone : personTwoButtonTone;
    return {
      "--sender-btn-bg": tone.main,
      "--sender-btn-bg-hover": tone.alt,
      "--sender-btn-text": tone.text,
    } as CSSProperties;
  };

  const getButtonClasses = (senderName: string): string => {
    if (feedbackState === "idle") return "sender-button rounded-full shadow-sm active:scale-95";
    if (revealedCorrectSender === senderName) return "sender-button rounded-full shadow-sm active:scale-95";
    return isDark
      ? "rounded-full bg-white/15 text-white/35 opacity-55"
      : "rounded-full bg-gray-100 text-gray-400 opacity-40";
  };

  const getButtonLabel = (senderName: string): string => {
    const name = getFirstName(senderName);
    if (feedbackState !== "idle" && revealedCorrectSender === senderName) {
      return `${name} ✓`;
    }
    return name;
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
    }: {
      text: string;
      isBlue: boolean;
      isTarget?: boolean;
      showTail?: boolean;
      isStackTop?: boolean;
      timestamp?: string | null;
      showTimestamp?: boolean;
    },
  ) => (
    <div key={key} className={`flex flex-col ${isBlue ? "items-end" : "items-start"}`}>
      <div
        data-target-bubble={isTarget ? "true" : undefined}
        className={`px-4 py-2.5 text-[15px] leading-relaxed ${isBlue ? "bubble-sent" : "bubble-received"} ${!showTail ? "bubble-stack" : ""} ${isStackTop ? "bubble-stack-top" : ""} ${isTarget ? "bubble-target-highlight" : ""}`}
      >
        {text}
      </div>
      {showTimestamp && timestamp && (
        <p
          className={`mt-1.5 text-[11px] font-medium ${isDark ? "text-white/55" : "text-gray-500"} ${
            isBlue ? "pr-1 text-right" : "pl-1"
          }`}
        >
          {formatMessageTimestamp(timestamp)}
        </p>
      )}
    </div>
  );

  return (
    <div
      className="flex min-h-[100dvh] items-stretch sm:items-center sm:justify-center sm:px-4 sm:py-8"
      style={{ background: phoneBackgroundTone.screen }}
    >
      <div
        className={`flex w-full flex-1 flex-col overflow-hidden sm:h-[min(844px,calc(100svh-4rem))] sm:flex-none sm:max-w-[390px] sm:rounded-[2.5rem] sm:border sm:shadow-sm ${
          isDark ? "sm:border-white/15" : "sm:border-gray-200"
        }`}
        style={{ background: phoneBackgroundTone.phone }}
      >
        {/* Header: back + score */}
        <div className="relative flex shrink-0 items-center justify-center px-6 pb-3 pt-[max(2rem,env(safe-area-inset-top))]">
          <Link
            href="/"
            className={`absolute left-6 flex items-center gap-0.5 text-sm font-medium transition active:scale-95 ${
              isDark ? "text-white/60 hover:text-white/85" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <svg
              aria-hidden
              className="h-4 w-4"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7.5 2.5 4 6l3.5 3.5" />
            </svg>
            Back
          </Link>
          <Link
            href="/settings"
            className={`absolute right-6 text-xs font-medium transition ${
              isDark ? "text-white/60 hover:text-white/85" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Settings
          </Link>
          <div
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm ${
              isDark ? "bg-black/20 text-white/70" : "bg-gray-100 text-gray-500"
            }`}
          >
            <span>
              Score:{" "}
              <span
                className={`inline-block font-semibold ${isDark ? "text-white/90" : "text-gray-700"} ${
                  scorePulse ? "animate-hud-pulse" : ""
                }`}
              >
                {score}
              </span>
            </span>
            <span className={isDark ? "text-white/30" : "text-gray-300"}>·</span>
            <span>
              Streak:{" "}
              <span
                className={`inline-block font-semibold ${isDark ? "text-white/90" : "text-gray-700"} ${
                  streakPulse ? "animate-hud-pulse" : ""
                }`}
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
              <p className={`text-sm ${isDark ? "text-white/55" : "text-gray-400"}`}>Loading...</p>
            </div>
          ) : !hasValidSetup ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
              <p className={`text-sm font-medium ${isDark ? "text-white/85" : "text-gray-600"}`}>Setup issue</p>
              <p className={`text-xs ${isDark ? "text-white/55" : "text-gray-400"}`}>
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
                    className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isDark
                        ? "border-white/20 bg-black/20 text-white/85 hover:bg-black/30"
                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                    }`}
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
                      className={`flex max-w-[82%] flex-col gap-[2px] ${isBlue ? "items-end" : "items-start"}`}
                    >
                      <p
                        className={`mb-0.5 text-[11px] font-semibold ${
                          isDark ? "text-white/70" : "text-gray-600"
                        } ${isBlue ? "pr-1 text-right" : "pl-1"}`}
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
                    className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isDark
                        ? "border-white/20 bg-black/20 text-white/85 hover:bg-black/30"
                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                    }`}
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
                      <p className={`mt-1.5 pr-1 text-[11px] ${isDark ? "text-white/50" : "text-gray-400"}`}>
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
                    <div className={`h-px flex-1 ${isDark ? "bg-white/15" : "bg-gray-200"}`} />
                    <span className={`text-[11px] ${isDark ? "text-white/50" : "text-gray-400"}`}>
                      Round {i + 2}
                    </span>
                    <div className={`h-px flex-1 ${isDark ? "bg-white/15" : "bg-gray-200"}`} />
                  </div>
                </div>
              ))}

              {playedRounds.length === 0 && (
                <div className="flex items-center gap-3 py-1">
                  <div className={`h-px flex-1 ${isDark ? "bg-white/15" : "bg-gray-200"}`} />
                  <span className={`text-[11px] ${isDark ? "text-white/50" : "text-gray-400"}`}>Round 1</span>
                  <div className={`h-px flex-1 ${isDark ? "bg-white/15" : "bg-gray-200"}`} />
                </div>
              )}

              {/* Active round */}
              <div className="flex w-full flex-col items-end pr-1">
                <div key={currentRound!.id} className="animate-bubble-pop-right max-w-[82%]">
                  <div className="bubble-sent px-4 py-2.5 text-[15px] leading-relaxed">
                    {currentRound!.text}
                  </div>
                </div>
                {feedbackState !== "idle" && revealedTimestamp && (
                  <p
                    className={`mt-1.5 pr-1 text-[11px] ${isDark ? "text-white/50" : "text-gray-400"} transition-all duration-300 ease-out ${
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

        {/* Controls — fixed footer height so buttons don't shift on load or after answering */}
        {(hasValidSetup || isLoadingRound) && (
          <div className="flex shrink-0 flex-col gap-5 px-6 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2.5">
              {(hasValidSetup ? senderOptions : ["", ""]).map((senderName, index) => (
                <button
                  key={hasValidSetup ? senderName : index}
                  type="button"
                  onClick={() => void handleGuess(senderName)}
                  disabled={
                    !hasValidSetup ||
                    isLoadingRound ||
                    feedbackState !== "idle" ||
                    isSubmittingGuess
                  }
                  className={`px-4 py-2.5 text-sm font-medium transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-100 ${
                    hasValidSetup
                      ? getButtonClasses(senderName)
                      : isDark
                        ? "rounded-full bg-white/15 text-transparent shadow-sm"
                        : "rounded-full bg-gray-200 text-transparent shadow-sm"
                  }`}
                  style={hasValidSetup ? getSenderButtonStyle(index) : undefined}
                >
                  {hasValidSetup ? getButtonLabel(senderName) : "\u00A0"}
                </button>
              ))}
            </div>

            <div className="relative h-[42px] w-full">
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-out ${
                  feedbackState !== "idle" && revealVisible
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {contextMessages === null ? (
                    <button
                      type="button"
                      onClick={() => void handleShowContext()}
                      disabled={isLoadingContext}
                      className={`rounded-full border px-6 py-2.5 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                        isDark
                          ? "border-white/20 bg-black/20 text-white/90 hover:bg-black/30"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {isLoadingContext ? "Loading…" : "View context"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleHideContext}
                      className={`rounded-full border px-6 py-2.5 text-sm font-semibold transition active:scale-95 ${
                        isDark
                          ? "border-white/20 bg-black/20 text-white/90 hover:bg-black/30"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Back to quote
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleNext()}
                    className={`rounded-full px-8 py-2.5 text-sm font-semibold transition active:scale-95 ${
                      isDark
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-gray-800 text-white hover:bg-gray-700"
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="flex justify-center gap-1.5">
                {Array.from({ length: SESSION_DOT_COUNT }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                      index < filledDots
                        ? isDark
                          ? "bg-white/65"
                          : "bg-gray-400"
                        : isDark
                          ? "bg-white/20"
                          : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <p className={`min-h-[14px] text-[10px] ${isDark ? "text-white/50" : "text-gray-400"}`}>
                {sessionGuesses > 0
                  ? `${filledDots} of ${SESSION_DOT_COUNT} this session`
                  : "\u00A0"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
