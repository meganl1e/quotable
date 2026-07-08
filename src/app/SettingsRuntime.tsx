"use client";

import { useEffect } from "react";

import { readStoredGameSettings, resolveEffectiveTheme } from "@/lib/gameSettings";

export function SettingsRuntime() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const settings = readStoredGameSettings();
      const theme = resolveEffectiveTheme(settings.themeMode, media.matches);
      document.documentElement.dataset.theme = theme;
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "quotable.settings.v1") return;
      applyTheme();
    };

    const onSettingsChanged = () => {
      applyTheme();
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    window.addEventListener("storage", onStorage);
    window.addEventListener("quotable:settings-changed", onSettingsChanged);

    return () => {
      media.removeEventListener("change", applyTheme);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("quotable:settings-changed", onSettingsChanged);
    };
  }, []);

  return null;
}
