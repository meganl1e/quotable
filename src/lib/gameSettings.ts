"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

export type ButtonColorPresetId =
  | "rosewood"
  | "terracotta"
  | "honey"
  | "sage"
  | "dustyTeal"
  | "lavenderGray"
  | "mauve"
  | "warmSlate";

export type PhoneBackgroundPresetId = "linen" | "sunsetMist" | "seaGlass" | "twilight";

export type GameSettings = {
  themeMode: ThemeMode;
  personOneButtonColorPreset: ButtonColorPresetId;
  personTwoButtonColorPreset: ButtonColorPresetId;
  phoneBackgroundPreset: PhoneBackgroundPresetId;
};

type PresetTone = {
  main: string;
  alt: string;
  text: string;
};

type ButtonColorPreset = {
  id: ButtonColorPresetId;
  name: string;
  light: PresetTone;
  dark: PresetTone;
};

type PhoneBackgroundPreset = {
  id: PhoneBackgroundPresetId;
  name: string;
  light: {
    screen: string;
    phone: string;
  };
  dark: {
    screen: string;
    phone: string;
  };
};

export const GAME_SETTINGS_STORAGE_KEY = "quotable.settings.v1";
const SETTINGS_CHANGED_EVENT = "quotable:settings-changed";

export const BUTTON_COLOR_PRESETS: readonly ButtonColorPreset[] = [
  {
    id: "rosewood",
    name: "Rose",
    light: { main: "#E25570", alt: "#CB3F5B", text: "#fff" },
    dark: { main: "#CB3F5B", alt: "#B5324D", text: "#fff" },
  },
  {
    id: "terracotta",
    name: "Coral",
    light: { main: "#EF6A40", alt: "#D95830", text: "#fff" },
    dark: { main: "#D95830", alt: "#C24A24", text: "#fff" },
  },
  {
    id: "honey",
    name: "Amber",
    light: { main: "#CC8B1F", alt: "#B67912", text: "#fff" },
    dark: { main: "#B67912", alt: "#9F680A", text: "#fff" },
  },
  {
    id: "sage",
    name: "Mint",
    light: { main: "#39B46A", alt: "#2EA35C", text: "#fff" },
    dark: { main: "#2EA35C", alt: "#25904F", text: "#fff" },
  },
  {
    id: "dustyTeal",
    name: "Teal",
    light: { main: "#1AA39D", alt: "#128F8A", text: "#fff" },
    dark: { main: "#128F8A", alt: "#0C7D78", text: "#fff" },
  },
  {
    id: "warmSlate",
    name: "Sky",
    light: { main: "#4E87E6", alt: "#3A75D8", text: "#fff" },
    dark: { main: "#3A75D8", alt: "#2B63C4", text: "#fff" },
  },
  {
    id: "lavenderGray",
    name: "Indigo",
    light: { main: "#6B69D6", alt: "#5A58C6", text: "#fff" },
    dark: { main: "#5A58C6", alt: "#4C4AB2", text: "#fff" },
  },
  {
    id: "mauve",
    name: "Fuchsia",
    light: { main: "#C353A6", alt: "#AE4292", text: "#fff" },
    dark: { main: "#AE4292", alt: "#99347E", text: "#fff" },
  },
] as const;

export const PHONE_BACKGROUND_PRESETS: readonly PhoneBackgroundPreset[] = [
  {
    id: "linen",
    name: "Linen",
    light: {
      screen: "#faf7f2",
      phone: "linear-gradient(180deg, #fdfbf7 0%, #f5efe6 100%)",
    },
    dark: {
      screen: "#17171a",
      phone: "linear-gradient(180deg, #2a2927 0%, #1f1e1c 100%)",
    },
  },
  {
    id: "sunsetMist",
    name: "Sunset Mist",
    light: {
      screen: "#f7f1ee",
      phone: "linear-gradient(165deg, #f7e3d4 0%, #edd7dd 55%, #d8d9ea 100%)",
    },
    dark: {
      screen: "#16151a",
      phone: "linear-gradient(165deg, #4f3f3a 0%, #3f3545 55%, #2f324a 100%)",
    },
  },
  {
    id: "seaGlass",
    name: "Sea Glass",
    light: {
      screen: "#eef5f4",
      phone: "linear-gradient(165deg, #e6f0e8 0%, #d7ece7 60%, #d4e3f2 100%)",
    },
    dark: {
      screen: "#14191a",
      phone: "linear-gradient(165deg, #2e3c38 0%, #284043 60%, #29374a 100%)",
    },
  },
  {
    id: "twilight",
    name: "Twilight",
    light: {
      screen: "#f1f2f8",
      phone: "linear-gradient(170deg, #e5e0f3 0%, #d9d7ee 55%, #d0dcee 100%)",
    },
    dark: {
      screen: "#13141c",
      phone: "linear-gradient(170deg, #312e47 0%, #2a2f49 55%, #26364b 100%)",
    },
  },
] as const;

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  themeMode: "system",
  personOneButtonColorPreset: "warmSlate",
  personTwoButtonColorPreset: "terracotta",
  phoneBackgroundPreset: "linen",
};

const BUTTON_PRESET_IDS = new Set<string>(BUTTON_COLOR_PRESETS.map((preset) => preset.id));
const PHONE_BACKGROUND_IDS = new Set<string>(PHONE_BACKGROUND_PRESETS.map((preset) => preset.id));

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

const sanitizeSettings = (value: unknown): GameSettings => {
  if (!value || typeof value !== "object") {
    return DEFAULT_GAME_SETTINGS;
  }

  const candidate = value as Partial<GameSettings>;
  const legacyPersonColor =
    typeof (candidate as { personButtonColorPreset?: unknown }).personButtonColorPreset === "string"
      ? (candidate as { personButtonColorPreset: string }).personButtonColorPreset
      : null;

  const personOneValue =
    typeof candidate.personOneButtonColorPreset === "string"
      ? candidate.personOneButtonColorPreset
      : legacyPersonColor;
  const personTwoValue =
    typeof candidate.personTwoButtonColorPreset === "string"
      ? candidate.personTwoButtonColorPreset
      : legacyPersonColor;

  return {
    themeMode: isThemeMode(candidate.themeMode) ? candidate.themeMode : DEFAULT_GAME_SETTINGS.themeMode,
    personOneButtonColorPreset: BUTTON_PRESET_IDS.has(personOneValue ?? "")
      ? (personOneValue as ButtonColorPresetId)
      : DEFAULT_GAME_SETTINGS.personOneButtonColorPreset,
    personTwoButtonColorPreset: BUTTON_PRESET_IDS.has(personTwoValue ?? "")
      ? (personTwoValue as ButtonColorPresetId)
      : DEFAULT_GAME_SETTINGS.personTwoButtonColorPreset,
    phoneBackgroundPreset: PHONE_BACKGROUND_IDS.has(candidate.phoneBackgroundPreset ?? "")
      ? candidate.phoneBackgroundPreset!
      : DEFAULT_GAME_SETTINGS.phoneBackgroundPreset,
  };
};

export const resolveEffectiveTheme = (
  themeMode: ThemeMode,
  systemPrefersDark: boolean,
): EffectiveTheme => {
  if (themeMode === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return themeMode;
};

export const readStoredGameSettings = (): GameSettings => {
  if (typeof window === "undefined") return DEFAULT_GAME_SETTINGS;
  try {
    const raw = window.localStorage.getItem(GAME_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_SETTINGS;
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
};

const emitSettingsChange = (settings: GameSettings) => {
  window.dispatchEvent(
    new CustomEvent<GameSettings>(SETTINGS_CHANGED_EVENT, {
      detail: settings,
    }),
  );
};

const writeStoredGameSettings = (settings: GameSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  emitSettingsChange(settings);
};

export const getButtonPreset = (id: ButtonColorPresetId): ButtonColorPreset =>
  BUTTON_COLOR_PRESETS.find((preset) => preset.id === id) ?? BUTTON_COLOR_PRESETS[0]!;

export const getPhoneBackgroundPreset = (id: PhoneBackgroundPresetId): PhoneBackgroundPreset =>
  PHONE_BACKGROUND_PRESETS.find((preset) => preset.id === id) ?? PHONE_BACKGROUND_PRESETS[0]!;

export function useGameSettings() {
  const [settings, setSettings] = useState<GameSettings>(() => readStoredGameSettings());
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemPrefersDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== GAME_SETTINGS_STORAGE_KEY) return;
      setSettings(readStoredGameSettings());
    };
    const onCustomChange = (event: Event) => {
      const detail = (event as CustomEvent<GameSettings>).detail;
      setSettings(sanitizeSettings(detail));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onCustomChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onCustomChange);
    };
  }, []);

  const updateSettings = useCallback(
    (updater: Partial<GameSettings> | ((current: GameSettings) => GameSettings)) => {
      setSettings((current) => {
        const nextValue =
          typeof updater === "function"
            ? (updater as (current: GameSettings) => GameSettings)(current)
            : { ...current, ...updater };
        const sanitized = sanitizeSettings(nextValue);
        writeStoredGameSettings(sanitized);
        return sanitized;
      });
    },
    [],
  );

  const resetSettings = useCallback(() => {
    updateSettings(() => DEFAULT_GAME_SETTINGS);
  }, [updateSettings]);

  const effectiveTheme = useMemo(
    () => resolveEffectiveTheme(settings.themeMode, systemPrefersDark),
    [settings.themeMode, systemPrefersDark],
  );

  const personOneButtonPreset = useMemo(
    () => getButtonPreset(settings.personOneButtonColorPreset),
    [settings.personOneButtonColorPreset],
  );

  const personTwoButtonPreset = useMemo(
    () => getButtonPreset(settings.personTwoButtonColorPreset),
    [settings.personTwoButtonColorPreset],
  );

  const phoneBackgroundPreset = useMemo(
    () => getPhoneBackgroundPreset(settings.phoneBackgroundPreset),
    [settings.phoneBackgroundPreset],
  );

  const personOneButtonTone = effectiveTheme === "dark" ? personOneButtonPreset.dark : personOneButtonPreset.light;
  const personTwoButtonTone = effectiveTheme === "dark" ? personTwoButtonPreset.dark : personTwoButtonPreset.light;
  const phoneBackgroundTone = effectiveTheme === "dark" ? phoneBackgroundPreset.dark : phoneBackgroundPreset.light;

  return {
    settings,
    effectiveTheme,
    personOneButtonPreset,
    personTwoButtonPreset,
    phoneBackgroundPreset,
    personOneButtonTone,
    personTwoButtonTone,
    phoneBackgroundTone,
    updateSettings,
    resetSettings,
  };
}
