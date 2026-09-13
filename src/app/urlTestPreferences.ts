import { loadStoredJson, saveStoredJson } from "../lib/storage";

const URL_TEST_KEY = "url-test";
export const URL_TEST_PREFERENCES_EVENT = "url-test-preferences-change";
export const MAX_URL_TEST_MS = 2_147_483_647;

export interface URLTestPreferences {
  ipv6Test: boolean;
  url: string;
  timeoutMs: number;
  yellowThresholdMs: number;
  redThresholdMs: number;
}

export const DEFAULT_URL_TEST_PREFERENCES: Readonly<URLTestPreferences> = {
  ipv6Test: false,
  url: "https://www.gstatic.com/generate_204",
  timeoutMs: 15000,
  yellowThresholdMs: 800,
  redThresholdMs: 1500,
};

export function isValidURLTestUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeURLTestPreferences(value: unknown): URLTestPreferences {
  const defaults = DEFAULT_URL_TEST_PREFERENCES;
  if (typeof value !== "object" || value === null) {
    return { ...defaults };
  }
  const stored = value as Record<string, unknown>;
  const milliseconds = (key: "timeoutMs" | "yellowThresholdMs" | "redThresholdMs") => {
    const number = stored[key];
    return typeof number === "number" && Number.isInteger(number) && number > 0 && number <= MAX_URL_TEST_MS
      ? number
      : defaults[key];
  };
  let yellowThresholdMs = milliseconds("yellowThresholdMs");
  let redThresholdMs = milliseconds("redThresholdMs");
  if (yellowThresholdMs >= redThresholdMs) {
    yellowThresholdMs = defaults.yellowThresholdMs;
    redThresholdMs = defaults.redThresholdMs;
  }
  return {
    ipv6Test: stored.ipv6Test === true,
    url: typeof stored.url === "string" && isValidURLTestUrl(stored.url.trim()) ? stored.url.trim() : defaults.url,
    timeoutMs: milliseconds("timeoutMs"),
    yellowThresholdMs,
    redThresholdMs,
  };
}

export function loadURLTestPreferences(): URLTestPreferences {
  return normalizeURLTestPreferences(loadStoredJson(URL_TEST_KEY));
}

export function saveURLTestPreferences(value: URLTestPreferences): void {
  saveStoredJson(URL_TEST_KEY, normalizeURLTestPreferences(value));
  window.dispatchEvent(new Event(URL_TEST_PREFERENCES_EVENT));
}
