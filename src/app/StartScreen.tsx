"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NOTIFICATION_MESSAGE = "ok i need to tell you something 💀";

const formatStatusTime = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

const StatusIcons = () => (
  <div className="flex items-center gap-1.5 text-gray-400">
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

  useEffect(() => {
    const update = () => setTime(formatStatusTime(new Date()));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-4 py-8">
      <div className="relative flex h-[min(844px,calc(100svh-4rem))] w-full max-w-[390px] flex-col overflow-hidden rounded-[2.5rem] border border-gray-200 bg-[#FAF7F2] shadow-sm">

        {/* Status bar */}
        <div className="flex shrink-0 items-center justify-between px-8 pb-2 pt-5">
          <span className="text-[13px] font-semibold tabular-nums text-gray-400">{time}</span>
          <StatusIcons />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">

          {/* Notification — hero, centered */}
          <div className="flex flex-1 items-center justify-center px-6 pb-4">
            <div className="animate-start-notification-in w-full max-w-[300px] rounded-2xl border border-gray-100 bg-white p-4 shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Messages
                </span>
                <span className="text-[11px] text-gray-400">now</span>
              </div>
              <p className="text-[15px] leading-snug text-gray-900">{NOTIFICATION_MESSAGE}</p>
            </div>
          </div>

          {/* Bottom sheet */}
          <div className="animate-start-sheet-in shrink-0 rounded-t-[1.75rem] border-t border-gray-100 bg-white px-6 pb-10 pt-8 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-4xl font-light tracking-tight text-gray-900">quotable</h1>
                <p className="text-sm text-gray-500">guess who sent it</p>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href="/game"
                  className="flex w-full items-center justify-center rounded-full bg-gray-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 active:scale-95"
                >
                  Use My Messages
                </Link>
                <Link
                  href="/game?mode=sample"
                  className="text-center text-sm text-gray-500 transition hover:text-gray-800"
                >
                  try sample chat →
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
