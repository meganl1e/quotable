"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useGameSettings } from "@/lib/gameSettings";
import { getNextStartNotification } from "@/lib/startNotifications";

const formatStatusTime = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

const StatusIcons = ({ isDark }: { isDark: boolean }) => (
  <div className={`flex items-center gap-1.5 ${isDark ? "text-white/55" : "text-gray-400"}`}>
    <svg aria-hidden className="h-2.5 w-3.5" viewBox="0 0 18 12" fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx="0.5" />
      <rect x="5" y="5" width="3" height="7" rx="0.5" />
      <rect x="10" y="2" width="3" height="10" rx="0.5" />
      <rect x="15" y="0" width="3" height="12" rx="0.5" />
    </svg>
    <svg aria-hidden className="h-2.5 w-[18px]" viewBox="0 0 27 13" fill="none">
      <rect x="0.5" y="0.5" width="22" height="12" rx="3" stroke="currentColor" strokeOpacity="0.5" />
      <rect x="2" y="2" width="17" height="9" rx="1.5" fill="currentColor" fillOpacity="0.6" />
      <rect x="24" y="4" width="2.5" height="5" rx="1" fill="currentColor" fillOpacity="0.4" />
    </svg>
  </div>
);

export function StartScreen() {
  const [time, setTime] = useState("");
  const [notification] = useState<string | null>(() => getNextStartNotification());
  const { effectiveTheme, phoneBackgroundTone } = useGameSettings();
  const isDark = effectiveTheme === "dark";

  useEffect(() => {
    const update = () => setTime(formatStatusTime(new Date()));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="flex min-h-[100dvh] items-stretch sm:items-center sm:justify-center sm:px-4 sm:py-8"
      style={{ background: phoneBackgroundTone.screen }}
    >
      <div
        className={`relative flex w-full flex-1 flex-col overflow-hidden sm:h-[min(844px,calc(100svh-4rem))] sm:flex-none sm:max-w-[390px] sm:rounded-[2.5rem] sm:border sm:shadow-sm ${
          isDark ? "sm:border-white/15" : "sm:border-gray-200"
        }`}
        style={{ background: phoneBackgroundTone.phone }}
      >

        {/* Status bar */}
        <div className="flex shrink-0 items-center justify-between px-8 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <span className={`text-[13px] font-semibold tabular-nums ${isDark ? "text-white/60" : "text-gray-400"}`}>
            {time}
          </span>
          <StatusIcons isDark={isDark} />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">

          {/* Notification — hero, centered */}
          <div className="flex flex-1 items-center justify-center px-6 pb-4">
            <div
              key={notification ?? "loading"}
              className={`animate-start-notification-in w-full max-w-[300px] rounded-2xl border p-4 shadow-md ${
                isDark ? "border-white/10 bg-black/20" : "border-gray-100 bg-white"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    isDark ? "text-white/50" : "text-gray-400"
                  }`}
                >
                  Messages
                </span>
                <span className={`text-[11px] ${isDark ? "text-white/50" : "text-gray-400"}`}>now</span>
              </div>
              <p className={`line-clamp-3 text-[15px] leading-snug ${isDark ? "text-white/90" : "text-gray-900"}`}>
                {notification ?? "\u00A0"}
              </p>
            </div>
          </div>

          {/* Bottom sheet */}
          <div
            className={`animate-start-sheet-in shrink-0 rounded-t-[1.75rem] border-t px-6 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] ${
              isDark
                ? "border-white/10 bg-black/30 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
                : "border-gray-100 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.06)]"
            }`}
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1.5">
                <h1 className={`text-4xl font-normal tracking-tight ${isDark ? "text-white/90" : "text-gray-600"}`}>
                  quotable
                </h1>
                <p className={`text-sm ${isDark ? "text-white/60" : "text-gray-500"}`}>guess who sent it</p>
              </div>

              <div className="flex flex-col gap-3">
                {process.env.NEXT_PUBLIC_DEMO_ONLY === "true" ? (
                  <div
                    className={`flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold ${
                      isDark
                        ? "bg-white/15 text-white/40"
                        : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    use my chat
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      isDark ? "bg-white/10 text-white/50" : "bg-gray-300 text-gray-500"
                    }`}>
                      coming soon
                    </span>
                  </div>
                ) : (
                  <Link
                    href="/game"
                    className={`flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition active:scale-95 ${
                      isDark
                        ? "bg-white text-[#151518] hover:bg-white/90"
                        : "bg-[#0A84FF] text-white hover:bg-[#0070E0]"
                    }`}
                  >
                    use my chat
                  </Link>
                )}
                <Link
                  href="/demo"
                  className={`text-center text-sm transition ${
                    isDark ? "text-white/80 hover:text-white" : "text-[#0A84FF] hover:text-[#0070E0]"
                  }`}
                >
                  try sample chat →
                </Link>
                <Link
                  href="/settings"
                  className={`text-center text-xs transition ${
                    isDark ? "text-white/55 hover:text-white/75" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  settings
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
