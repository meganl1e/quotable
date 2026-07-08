// Punchy preview lines from data/sample-data.json — kept short for the lock-screen card
export const START_NOTIFICATION_MESSAGES = [
  "ok i need to tell you something insane",
  "guess who almost got hit by a bird today",
  "a SECRET cat alex",
  "the system says no lmaooo",
  "yo you up",
  "self sabotage hours",
  "the gas station saved us honestly",
  "cat detective jordan",
  "no bc i'm a coward",
  "a mechanical SMELL",
  "running on coffee and vibes",
  "pigeons know things we don't",
  "respect the honesty",
  "the hot dog man remains undefeated then",
  "some kind of curse follows us specifically",
  "incredible customer service",
  "the sister plot hole will haunt me",
  "midnight hot dogs are non negotiable",
  "a normal night, groundbreaking for us",
  "you said that about the umbrella too",
] as const;

const STORAGE_KEY = "quotable-start-notification-index";

export const getNextStartNotification = (): string => {
  const messages = START_NOTIFICATION_MESSAGES;
  if (typeof window === "undefined") {
    return messages[0]!;
  }

  const lastIndex = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? "-1", 10);
  const nextIndex = Number.isNaN(lastIndex)
    ? 0
    : (lastIndex + 1) % messages.length;

  sessionStorage.setItem(STORAGE_KEY, String(nextIndex));
  return messages[nextIndex]!;
};
