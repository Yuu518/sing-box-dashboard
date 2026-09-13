import { afterEach, describe, expect, it, vi } from "vitest";

import { urlTestDelayTone } from "../api/format";
import {
  DEFAULT_URL_TEST_PREFERENCES,
  URL_TEST_PREFERENCES_EVENT,
  isValidURLTestUrl,
  loadURLTestPreferences,
  normalizeURLTestPreferences,
  saveURLTestPreferences,
} from "./urlTestPreferences";

afterEach(() => vi.unstubAllGlobals());

describe("URL test preferences", () => {
  it("fills missing and invalid values with concrete defaults", () => {
    expect(normalizeURLTestPreferences(null)).toEqual(DEFAULT_URL_TEST_PREFERENCES);
    expect(normalizeURLTestPreferences({
      url: "javascript:alert(1)", timeoutMs: "", redThresholdMs: -1, yellowThresholdMs: 1.5,
    })).toEqual(DEFAULT_URL_TEST_PREFERENCES);
    expect(normalizeURLTestPreferences({ timeoutMs: Infinity }).timeoutMs).toBe(15000);
    expect(normalizeURLTestPreferences({ timeoutMs: 2 ** 31 }).timeoutMs).toBe(15000);
  });

  it("preserves custom values and repairs invalid threshold ordering", () => {
    expect(normalizeURLTestPreferences({
      url: " https://example.com/ping ", timeoutMs: 5000, yellowThresholdMs: 200, redThresholdMs: 600,
    })).toEqual({ url: "https://example.com/ping", timeoutMs: 5000, yellowThresholdMs: 200, redThresholdMs: 600 });
    for (const yellowThresholdMs of [1500, 2000]) {
      const normalized = normalizeURLTestPreferences({ yellowThresholdMs, redThresholdMs: 1500 });
      expect(normalized.yellowThresholdMs).toBe(800);
      expect(normalized.redThresholdMs).toBe(1500);
    }
    expect(isValidURLTestUrl("http://localhost/check")).toBe(true);
    expect(isValidURLTestUrl("ftp://example.com")).toBe(false);
    expect(isValidURLTestUrl("not a url")).toBe(false);
  });

  it("persists values across reloads and notifies the current window", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const listener = vi.fn();
    target.addEventListener(URL_TEST_PREFERENCES_EVENT, listener);
    const preferences = { ...DEFAULT_URL_TEST_PREFERENCES, timeoutMs: 3000, yellowThresholdMs: 100, redThresholdMs: 300 };
    saveURLTestPreferences(preferences);
    expect(loadURLTestPreferences()).toEqual(preferences);
    expect(listener).toHaveBeenCalledOnce();
    values.set("sing-box-dashboard.url-test", "invalid JSON");
    expect(loadURLTestPreferences()).toEqual(DEFAULT_URL_TEST_PREFERENCES);
  });
});

describe("URL test delay colors", () => {
  it("uses inclusive custom yellow and red thresholds", () => {
    const thresholds = { yellowThresholdMs: 100, redThresholdMs: 300 };
    expect([-1, 0, 99, 100, 299, 300, 1000].map((delay) => urlTestDelayTone(delay, thresholds)))
      .toEqual(["neutral", "neutral", "good", "medium", "medium", "bad", "bad"]);
  });

  it("retains existing default boundaries", () => {
    expect([799, 800, 1499, 1500].map((delay) => urlTestDelayTone(delay)))
      .toEqual(["good", "medium", "medium", "bad"]);
  });
});
