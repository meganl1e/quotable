import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  filterMessages,
  hydrateDataset,
  type PreparedMessage,
  type RawChatMessage,
} from "./filterMessages";

export type GameRound = {
  id: string;
  text: string;
};

export type GuessResult = {
  correct: boolean;
  correctSender: string;
  timestamp: string;
};

export type ContextMessage = {
  sender: string;
  text: string;
  timestamp: string;
  isTarget: boolean;
};

type CachedDataset = ReturnType<typeof hydrateDataset>;

type DatasetCache = {
  dataset: CachedDataset;
  expiresAt: number;
};

type ChatIndexFile = {
  version: number;
  generatedAt: string;
  messageCount: number;
  senderOptions: string[];
  messages: PreparedMessage[];
};

const DATA_DIR = join(process.cwd(), "src/data");
const INDEX_PATH = join(DATA_DIR, "chat_index.json");
const RAW_PATH = join(DATA_DIR, "chat_data.json");

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DATASET_TTL_MS = Number(process.env.GAME_DATASET_TTL_MS ?? DEFAULT_TTL_MS);

let cache: DatasetCache | null = null;

const readJsonFile = <T>(path: string): T => {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as T;
};

const loadFromPrecomputedIndex = (): CachedDataset | null => {
  if (!existsSync(INDEX_PATH)) return null;

  const index = readJsonFile<ChatIndexFile>(INDEX_PATH);
  if (!Array.isArray(index.messages) || index.messages.length === 0) return null;

  return hydrateDataset(index.messages);
};

const loadFromRawMessages = (): CachedDataset => {
  if (!existsSync(RAW_PATH)) {
    return hydrateDataset([]);
  }

  const rawMessages = readJsonFile<RawChatMessage[]>(RAW_PATH);
  const filtered = filterMessages(rawMessages);
  return hydrateDataset(filtered.messages);
};

const buildDataset = (): CachedDataset => {
  const fromIndex = loadFromPrecomputedIndex();
  if (fromIndex) return fromIndex;

  return loadFromRawMessages();
};

const getDataset = (): CachedDataset => {
  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return cache.dataset;
  }

  const dataset = buildDataset();
  cache = {
    dataset,
    expiresAt: now + DATASET_TTL_MS,
  };

  return dataset;
};

export const getDatasetHealth = () => {
  const dataset = getDataset();

  if (dataset.messages.length === 0) {
    return "No guessable messages available in the dataset.";
  }

  if (dataset.senderOptions.length !== 2) {
    return `Expected exactly 2 unique senders after filtering, found ${dataset.senderOptions.length}.`;
  }

  return null;
};

export const getSenderOptions = (): string[] => getDataset().senderOptions.slice(0, 2);

const weightedRandom = (items: PreparedMessage[]): PreparedMessage => {
  const total = items.reduce((sum, item) => sum + (item.score ?? 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.score ?? 1;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
};

export const getRandomRound = (excludeId?: string): GameRound | null => {
  const dataset = getDataset();
  const candidates =
    excludeId && dataset.messages.length > 1
      ? dataset.messages.filter((message) => message.id !== excludeId)
      : dataset.messages;

  if (candidates.length === 0) return null;
  const selected = weightedRandom(candidates);

  return {
    id: selected.id,
    text: selected.text,
  };
};

export const checkGuess = (roundId: string, guessedSender: string): GuessResult | null => {
  const message = getDataset().byId.get(roundId);
  if (!message) return null;

  return {
    correct: message.sender === guessedSender,
    correctSender: message.sender,
    timestamp: message.timestamp,
  };
};

// ---------------------------------------------------------------------------
// Raw message context — loads chat_data.json once and caches in memory
// ---------------------------------------------------------------------------

let rawMessagesCache: RawChatMessage[] | null = null;

const getRawMessages = (): RawChatMessage[] => {
  if (rawMessagesCache) return rawMessagesCache;

  if (!existsSync(RAW_PATH)) {
    rawMessagesCache = [];
    return rawMessagesCache;
  }

  rawMessagesCache = readJsonFile<RawChatMessage[]>(RAW_PATH);
  return rawMessagesCache;
};

const DEFAULT_CONTEXT_WINDOW = 3;

export const getMessageContext = (
  roundId: string,
  windowSize: number = DEFAULT_CONTEXT_WINDOW,
): ContextMessage[] | null => {
  const message = getDataset().byId.get(roundId);
  if (!message || message.rawIndex === undefined) return null;

  const raw = getRawMessages();
  if (raw.length === 0) return null;

  const { rawIndex } = message;
  const start = Math.max(0, rawIndex - windowSize);
  const end = Math.min(raw.length - 1, rawIndex + windowSize);

  const result: ContextMessage[] = [];
  for (let i = start; i <= end; i++) {
    const r = raw[i]!;
    result.push({
      sender: r.sender,
      text: r.text,
      timestamp: r.timestamp,
      isTarget: i === rawIndex,
    });
  }

  return result;
};
