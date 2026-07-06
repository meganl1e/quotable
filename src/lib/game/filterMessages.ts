export type RawChatMessage = {
  sender: string;
  text: string;
  timestamp: string;
};

export type PreparedMessage = {
  id: string;
  rawIndex: number;
  sender: string;
  text: string;
  timestamp: string;
  score?: number;
};

export type PreparedDataset = {
  messages: PreparedMessage[];
  senderOptions: string[];
};

// ---------------------------------------------------------------------------
// Basic filtering helpers
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "ok",
  "lol",
  "yeah",
  "k",
  "haha",
  "yes",
  "no",
  "thanks",
  "np",
  "sure",
  "wyd",
  "hi",
  "hey",
]);

const normalizeText = (value: string): string => value.trim().toLowerCase();

const normalizeForStopwordCheck = (value: string): string =>
  normalizeText(value).replace(/[^a-z0-9\s]/g, "");

const getWordCount = (value: string): number =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const isGuessableMessage = (message: RawChatMessage): boolean => {
  const trimmed = message.text.trim();
  if (!trimmed) return false;
  if (trimmed.length < 20) return false;
  if (getWordCount(trimmed) < 4) return false;
  if (trimmed.toLowerCase().startsWith("http")) return false;
  if (STOPWORDS.has(normalizeForStopwordCheck(trimmed))) return false;
  return true;
};

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

const FILLER_WORDS = new Set([
  "yeah",
  "just",
  "gonna",
  "think",
  "going",
  "okay",
  "sure",
]);

const BONUS_KEYWORDS = [
  "lol",
  "omg",
  "wtf",
  "literally",
  "can't believe",
  "remember when",
  "embarrassing",
  "secret",
  "hate",
  "love",
  "miss you",
  "crying",
  "drunk",
];

const LOGISTICS_PHRASES = [
  "on my way",
  "see you at",
  "call me",
  "what time",
  "where are you",
];

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

const buildWordFrequency = (messages: PreparedMessage[]): Map<string, number> => {
  const freq = new Map<string, number>();
  for (const msg of messages) {
    for (const word of tokenize(msg.text)) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return freq;
};

const scoreMessage = (text: string, wordFreq: Map<string, number>): number => {
  const lower = text.toLowerCase();
  const words = tokenize(lower);
  let score = 0;

  // IDF-like: rare words boost the score, filler words contribute nothing
  if (words.length > 0) {
    let idfSum = 0;
    for (const word of words) {
      if (!FILLER_WORDS.has(word)) {
        idfSum += 1 / (wordFreq.get(word) ?? 1);
      }
    }
    score += (idfSum / words.length) * 100;
  }

  // Format bonuses
  if (text.includes("!")) score += 2;
  if (text.includes("?")) score += 1;
  if (/\p{Emoji_Presentation}/u.test(text)) score += 2;
  if (/\b[A-Z]{3,}\b/.test(text)) score += 2;

  // Keyword bonuses
  for (const kw of BONUS_KEYWORDS) {
    if (lower.includes(kw)) score += 3;
  }

  // Logistics penalties
  for (const phrase of LOGISTICS_PHRASES) {
    if (lower.includes(phrase)) score -= 3;
  }

  // Ensure every message has at least a tiny weight so nothing is fully excluded
  return Math.max(score, 0.1);
};

const scoreMessages = (messages: PreparedMessage[]): PreparedMessage[] => {
  const wordFreq = buildWordFrequency(messages);
  return messages.map((msg) => ({
    ...msg,
    score: scoreMessage(msg.text, wordFreq),
  }));
};

// ---------------------------------------------------------------------------
// Display normalization
// Runs after scoring so scoring signals (ALL CAPS, punctuation) are captured
// from the original text before it is normalized for display.
// ---------------------------------------------------------------------------

export const normalizeMessageText = (text: string): string => {
  let result = text;

  // 1. Lowercase
  result = result.toLowerCase();

  // 2. Strip trailing period(s) (keep ? and !)
  result = result.replace(/\.+$/, "");

  // 3. Collapse 3+ consecutive identical characters down to 2
  //    e.g. "soooo" → "soo", "noooo" → "noo"
  result = result.replace(/(.)\1{2,}/g, "$1$1");

  // 4a. Collapse multiple spaces to one
  result = result.replace(/ {2,}/g, " ");

  // 4b. Ensure a space follows , ! ? when immediately followed by a letter
  result = result.replace(/([,!?])([a-z])/g, "$1 $2");

  return result.trim();
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const filterMessages = (messages: RawChatMessage[]): PreparedDataset => {
  const seenText = new Set<string>();
  const prepared: PreparedMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]!;
    if (!isGuessableMessage(message)) continue;

    const text = message.text.trim();
    const textKey = normalizeText(text);
    if (seenText.has(textKey)) continue;
    seenText.add(textKey);

    prepared.push({
      id: `${prepared.length}`,
      rawIndex: i,
      sender: message.sender.trim(),
      text,
      timestamp: message.timestamp,
    });
  }

  const scored = scoreMessages(prepared);
  const normalized = scored.map((msg) => ({
    ...msg,
    text: normalizeMessageText(msg.text),
  }));
  const senderOptions = [...new Set(normalized.map((message) => message.sender))];

  return {
    messages: normalized,
    senderOptions,
  };
};

export const hydrateDataset = (messages: PreparedMessage[]): PreparedDataset & {
  byId: Map<string, PreparedMessage>;
} => {
  const senderOptions = [...new Set(messages.map((message) => message.sender))];
  const byId = new Map(messages.map((message) => [message.id, message]));

  return {
    messages,
    senderOptions,
    byId,
  };
};
