import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  filterMessages,
  hydrateDataset,
  type PreparedMessage,
  type RawChatMessage,
} from "./filterMessages";

export type DatasetMode = "main" | "sample";

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
  rawIndex: number;
  sender: string;
  text: string;
  timestamp: string;
  isTarget: boolean;
};

export type ContextBounds = {
  startIndex: number;
  endIndex: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

export type ContextPageResult = {
  context: ContextMessage[];
  bounds: ContextBounds;
};

export type ContextPageOptions = {
  before?: number;
  after?: number;
  startIndex?: number;
  endIndex?: number;
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

// Raw format used in data/sample-data.json
type SampleRawMessage = {
  sendername: string;
  timestampms: number;
  content: string;
};

const DATA_DIR = join(process.cwd(), "src/data");
const INDEX_PATH = join(DATA_DIR, "chat_index.json");
const RAW_PATH = join(DATA_DIR, "chat_data.json");
const SAMPLE_PATH = join(process.cwd(), "data/sample-data.json");

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DATASET_TTL_MS = Number(process.env.GAME_DATASET_TTL_MS ?? DEFAULT_TTL_MS);

const caches = new Map<DatasetMode, DatasetCache>();

const readJsonFile = <T>(path: string): T => {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as T;
};

const convertSampleMessage = (m: SampleRawMessage): RawChatMessage => ({
  sender: m.sendername,
  text: m.content,
  timestamp: new Date(m.timestampms).toISOString(),
});

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

const loadSampleDataset = (): CachedDataset => {
  if (!existsSync(SAMPLE_PATH)) {
    return hydrateDataset([]);
  }

  const sampleMessages = readJsonFile<SampleRawMessage[]>(SAMPLE_PATH);
  const rawMessages = sampleMessages.map(convertSampleMessage);
  const filtered = filterMessages(rawMessages);
  return hydrateDataset(filtered.messages);
};

const buildDataset = (mode: DatasetMode): CachedDataset => {
  if (mode === "sample") return loadSampleDataset();

  const fromIndex = loadFromPrecomputedIndex();
  if (fromIndex) return fromIndex;

  return loadFromRawMessages();
};

const getDataset = (mode: DatasetMode): CachedDataset => {
  const now = Date.now();
  const cached = caches.get(mode);

  if (cached && cached.expiresAt > now) {
    return cached.dataset;
  }

  const dataset = buildDataset(mode);
  caches.set(mode, {
    dataset,
    expiresAt: now + DATASET_TTL_MS,
  });

  return dataset;
};

export const getDatasetHealth = (mode: DatasetMode = "main") => {
  const dataset = getDataset(mode);

  if (dataset.messages.length === 0) {
    return "No guessable messages available in the dataset.";
  }

  if (dataset.senderOptions.length !== 2) {
    return `Expected exactly 2 unique senders after filtering, found ${dataset.senderOptions.length}.`;
  }

  return null;
};

export const getSenderOptions = (mode: DatasetMode = "main"): string[] =>
  getDataset(mode).senderOptions.slice(0, 2);

const weightedRandom = (items: PreparedMessage[]): PreparedMessage => {
  const total = items.reduce((sum, item) => sum + (item.score ?? 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.score ?? 1;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
};

export const getRandomRound = (excludeId?: string, mode: DatasetMode = "main"): GameRound | null => {
  const dataset = getDataset(mode);
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

export const checkGuess = (
  roundId: string,
  guessedSender: string,
  mode: DatasetMode = "main",
): GuessResult | null => {
  const message = getDataset(mode).byId.get(roundId);
  if (!message) return null;

  return {
    correct: message.sender === guessedSender,
    correctSender: message.sender,
    timestamp: message.timestamp,
  };
};

// ---------------------------------------------------------------------------
// Raw message context — loads source data once per mode and caches in memory
// ---------------------------------------------------------------------------

const rawMessagesCaches = new Map<DatasetMode, RawChatMessage[]>();

const getRawMessages = (mode: DatasetMode): RawChatMessage[] => {
  const cached = rawMessagesCaches.get(mode);
  if (cached) return cached;

  let messages: RawChatMessage[];

  if (mode === "sample") {
    if (!existsSync(SAMPLE_PATH)) {
      messages = [];
    } else {
      const sampleMessages = readJsonFile<SampleRawMessage[]>(SAMPLE_PATH);
      messages = sampleMessages.map(convertSampleMessage);
    }
  } else {
    if (!existsSync(RAW_PATH)) {
      messages = [];
    } else {
      messages = readJsonFile<RawChatMessage[]>(RAW_PATH);
    }
  }

  rawMessagesCaches.set(mode, messages);
  return messages;
};

const DEFAULT_CONTEXT_WINDOW = 3;
export const INITIAL_CONTEXT_BEFORE = 8;
export const INITIAL_CONTEXT_AFTER = 8;
export const CONTEXT_PAGE_SIZE = 10;
export const MAX_CONTEXT_PAGE = 30;

const clampPageSize = (value: number | undefined, fallback: number): number => {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), 1), MAX_CONTEXT_PAGE);
};

const buildContextSlice = (
  raw: RawChatMessage[],
  targetRawIndex: number,
  start: number,
  end: number,
): ContextMessage[] => {
  const result: ContextMessage[] = [];
  for (let i = start; i <= end; i++) {
    const r = raw[i]!;
    result.push({
      rawIndex: i,
      sender: r.sender,
      text: r.text,
      timestamp: r.timestamp,
      isTarget: i === targetRawIndex,
    });
  }
  return result;
};

export const getMessageContextPage = (
  roundId: string,
  options: ContextPageOptions = {},
  mode: DatasetMode = "main",
): ContextPageResult | null => {
  const message = getDataset(mode).byId.get(roundId);
  if (!message || message.rawIndex === undefined) return null;

  const raw = getRawMessages(mode);
  if (raw.length === 0) return null;

  const targetRawIndex = message.rawIndex;
  const lastIndex = raw.length - 1;

  let start: number;
  let end: number;

  if (options.endIndex !== undefined) {
    const pageSize = clampPageSize(options.before, CONTEXT_PAGE_SIZE);
    end = Math.max(0, options.endIndex);
    start = Math.max(0, end - pageSize + 1);
  } else if (options.startIndex !== undefined) {
    const pageSize = clampPageSize(options.after, CONTEXT_PAGE_SIZE);
    start = Math.min(lastIndex, options.startIndex + 1);
    end = Math.min(lastIndex, options.startIndex + pageSize);
    if (start > end) return { context: [], bounds: { startIndex: start, endIndex: end, hasMoreBefore: start > 0, hasMoreAfter: false } };
  } else {
    const before = clampPageSize(options.before, INITIAL_CONTEXT_BEFORE);
    const after = clampPageSize(options.after, INITIAL_CONTEXT_AFTER);
    start = Math.max(0, targetRawIndex - before);
    end = Math.min(lastIndex, targetRawIndex + after);
  }

  return {
    context: buildContextSlice(raw, targetRawIndex, start, end),
    bounds: {
      startIndex: start,
      endIndex: end,
      hasMoreBefore: start > 0,
      hasMoreAfter: end < lastIndex,
    },
  };
};

export const getMessageContext = (
  roundId: string,
  windowSize: number = DEFAULT_CONTEXT_WINDOW,
  mode: DatasetMode = "main",
): ContextMessage[] | null => {
  const page = getMessageContextPage(roundId, { before: windowSize, after: windowSize }, mode);
  return page?.context ?? null;
};
