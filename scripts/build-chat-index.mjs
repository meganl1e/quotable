import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const rawPath = join(rootDir, "src/data/chat_data.json");
const indexPath = join(rootDir, "src/data/chat_index.json");

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

const normalizeText = (value) => value.trim().toLowerCase();
const normalizeForStopwordCheck = (value) =>
  normalizeText(value).replace(/[^a-z0-9\s]/g, "");
const getWordCount = (value) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const isGuessableMessage = (message) => {
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

const tokenize = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

const buildWordFrequency = (messages) => {
  const freq = new Map();
  for (const msg of messages) {
    for (const word of tokenize(msg.text)) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return freq;
};

const scoreMessage = (text, wordFreq) => {
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

const scoreMessages = (messages, wordFreq) =>
  messages.map((msg) => ({ ...msg, score: scoreMessage(msg.text, wordFreq) }));

// ---------------------------------------------------------------------------
// Display normalization
// Runs after scoring so scoring signals (ALL CAPS, punctuation) are captured
// from the original text before it is normalized for display.
// ---------------------------------------------------------------------------

const normalizeMessageText = (text) => {
  let result = text;

  // 1. Lowercase
  result = result.toLowerCase();

  // 2. Strip trailing period(s) (keep ? and !)
  result = result.replace(/\.+$/, "");

  // 3. Collapse 3+ consecutive identical characters down to 2
  result = result.replace(/(.)\1{2,}/g, "$1$1");

  // 4a. Collapse multiple spaces to one
  result = result.replace(/ {2,}/g, " ");

  // 4b. Ensure a space follows , ! ? when immediately followed by a letter
  result = result.replace(/([,!?])([a-z])/g, "$1 $2");

  return result.trim();
};

// ---------------------------------------------------------------------------
// Filter + score pipeline
// ---------------------------------------------------------------------------

const filterMessages = (messages) => {
  const seenText = new Set();
  const prepared = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
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

  const wordFreq = buildWordFrequency(prepared);
  const scored = scoreMessages(prepared, wordFreq);
  const normalized = scored.map((msg) => ({
    ...msg,
    text: normalizeMessageText(msg.text),
  }));
  const senderOptions = [...new Set(normalized.map((message) => message.sender))];

  return { messages: normalized, senderOptions };
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!existsSync(rawPath)) {
  console.error(`Missing source file: ${rawPath}`);
  process.exit(1);
}

const startedAt = Date.now();
const rawMessages = JSON.parse(readFileSync(rawPath, "utf-8"));
const dataset = filterMessages(rawMessages);

const scoreValues = dataset.messages.map((m) => m.score);
const minScore = scoreValues.reduce((a, b) => Math.min(a, b), Infinity).toFixed(3);
const maxScore = scoreValues.reduce((a, b) => Math.max(a, b), -Infinity).toFixed(3);
const avgScore = (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(3);

const indexPayload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  messageCount: dataset.messages.length,
  senderOptions: dataset.senderOptions,
  messages: dataset.messages,
};

writeFileSync(indexPath, JSON.stringify(indexPayload));

const elapsedMs = Date.now() - startedAt;
console.log(
  `Wrote ${dataset.messages.length} guessable messages to ${indexPath} (${elapsedMs}ms)`,
);
console.log(`Score range: min=${minScore}, avg=${avgScore}, max=${maxScore}`);
