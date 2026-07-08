"use client";

import Link from "next/link";

import {
  BUTTON_COLOR_PRESETS,
  PHONE_BACKGROUND_PRESETS,
  type ThemeMode,
  useGameSettings,
} from "@/lib/gameSettings";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "light" },
  { value: "dark", label: "dark" },
  { value: "system", label: "system" },
];

export function SettingsScreen() {
  const { settings, effectiveTheme, phoneBackgroundTone, updateSettings, resetSettings } = useGameSettings();
  const isDark = effectiveTheme === "dark";
  const pickerRingClass = isDark ? "ring-1 ring-white/70" : "ring-1 ring-gray-700/40";

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-8"
      style={{ background: phoneBackgroundTone.screen }}
    >
      <div
        className={`flex h-[min(844px,calc(100svh-4rem))] w-full max-w-[390px] flex-col overflow-hidden rounded-[2.5rem] border shadow-sm ${
          isDark ? "border-white/15" : "border-gray-200"
        }`}
        style={{ background: phoneBackgroundTone.phone }}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-8">
          <Link
            href="/"
            className={`text-sm font-medium transition active:scale-95 ${
              isDark ? "text-white/65 hover:text-white/90" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ← back
          </Link>
          <h1 className={`text-sm font-semibold tracking-wide ${isDark ? "text-white/85" : "text-gray-700"}`}>
            settings
          </h1>
          <div className="w-[42px]" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
          <section
            className={`rounded-2xl border p-4 ${
              isDark ? "border-white/15 bg-black/20" : "border-gray-200 bg-white/80"
            }`}
          >
            <h2 className={`text-sm font-semibold ${isDark ? "text-white/90" : "text-gray-700"}`}>theme</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => {
                const isSelected = settings.themeMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateSettings({ themeMode: option.value })}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                      isSelected
                        ? isDark
                          ? "bg-white/90 text-black"
                          : "bg-gray-900 text-white"
                        : isDark
                          ? "bg-white/10 text-white/80 hover:bg-white/15"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className={`mt-4 rounded-2xl border p-4 ${
              isDark ? "border-white/15 bg-black/20" : "border-gray-200 bg-white/80"
            }`}
          >
            <h2 className={`text-sm font-semibold ${isDark ? "text-white/90" : "text-gray-700"}`}>
              button colors
            </h2>

            <p className={`mt-3 text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-500"}`}>
              left person
            </p>
            <div className="mt-2.5 grid grid-cols-4 gap-3">
              {BUTTON_COLOR_PRESETS.map((preset) => {
                const tone = isDark ? preset.dark : preset.light;
                const isSelected = settings.personOneButtonColorPreset === preset.id;
                return (
                  <button
                    key={`person-1-${preset.id}`}
                    type="button"
                    onClick={() => updateSettings({ personOneButtonColorPreset: preset.id })}
                    aria-label={`person 1: ${preset.name}`}
                    className={`relative h-10 w-10 rounded-full transition active:scale-90 ${
                      isSelected ? pickerRingClass : ""
                    }`}
                    style={{ background: tone.main }}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full">
                        <svg aria-hidden viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6.5l2.5 2.5 5.5-5" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className={`mt-4 text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-500"}`}>
              right person
            </p>
            <div className="mt-2.5 grid grid-cols-4 gap-3">
              {BUTTON_COLOR_PRESETS.map((preset) => {
                const tone = isDark ? preset.dark : preset.light;
                const isSelected = settings.personTwoButtonColorPreset === preset.id;
                return (
                  <button
                    key={`person-2-${preset.id}`}
                    type="button"
                    onClick={() => updateSettings({ personTwoButtonColorPreset: preset.id })}
                    aria-label={`person 2: ${preset.name}`}
                    className={`relative h-10 w-10 rounded-full transition active:scale-90 ${
                      isSelected ? pickerRingClass : ""
                    }`}
                    style={{ background: tone.main }}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full">
                        <svg aria-hidden viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6.5l2.5 2.5 5.5-5" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className={`mt-4 rounded-2xl border p-4 ${
              isDark ? "border-white/15 bg-black/20" : "border-gray-200 bg-white/80"
            }`}
          >
            <h2 className={`text-sm font-semibold ${isDark ? "text-white/90" : "text-gray-700"}`}>
              background
            </h2>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {PHONE_BACKGROUND_PRESETS.map((preset) => {
                const tone = isDark ? preset.dark : preset.light;
                const isSelected = settings.phoneBackgroundPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => updateSettings({ phoneBackgroundPreset: preset.id })}
                    aria-label={preset.name}
                    className={`relative h-20 rounded-2xl transition active:scale-[0.97] ${
                      isSelected ? pickerRingClass : "opacity-85 hover:opacity-100"
                    }`}
                    style={{ background: tone.phone }}
                  >
                    {isSelected && (
                      <span
                        className={`absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full ${
                          isDark ? "bg-white/90" : "bg-white/95"
                        }`}
                      >
                        <svg aria-hidden viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6.5l2.5 2.5 5.5-5" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("reset all settings to defaults?")) return;
                resetSettings();
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
                isDark
                  ? "bg-white/10 text-white/85 hover:bg-white/15"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              reset defaults
            </button>
            <Link
              href="/game"
              className={`rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
                isDark ? "bg-white/90 text-black hover:bg-white" : "bg-gray-900 text-white hover:bg-gray-700"
              }`}
            >
              back to game
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
