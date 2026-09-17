import { create } from "@bufbuild/protobuf";
import { Code } from "@connectrpc/connect";
import { afterEach, expect, it, vi } from "vitest";

import { RuleListSchema, VersionSchema } from "../gen/daemon/started_service_pb";
import { DaemonApi } from "./daemon";

afterEach(() => vi.restoreAllMocks());

function api() {
  return new DaemonApi({ id: "test", name: "test", url: "http://localhost", secret: "" }, "en");
}

it("does not subscribe to rules on legacy servers", async () => {
  const daemon = api();
  vi.spyOn(daemon.client, "getVersion").mockResolvedValue(create(VersionSchema, { apiVersion: 6, ruleProvidersSupported: true }));
  const subscribe = vi.spyOn(daemon.client, "subscribeRules");
  const stop = daemon.rules.subscribe(() => {});
  try {
    await vi.waitFor(() => expect(daemon.rules.getSnapshot().errorCode).toBe(Code.Unimplemented));
    expect(subscribe).not.toHaveBeenCalled();
  } finally {
    stop();
  }
});

it("replaces rules on reload and releases the stream when leaving", async () => {
  const daemon = api();
  vi.spyOn(daemon.client, "getVersion").mockResolvedValue(create(VersionSchema, { apiVersion: 7, rulesSupported: true }));
  let signal: AbortSignal | undefined;
  let reload: (() => void) | undefined;
  const reloaded = new Promise<void>((resolve) => { reload = resolve; });
  vi.spyOn(daemon.client, "subscribeRules").mockImplementation(async function* (_, options) {
    signal = options?.signal;
    yield create(RuleListSchema, { rules: [
      { type: "default", condition: "domain=example.com", action: "route", actionDescription: "route(proxy)" },
      { type: "logical", condition: "!(network=tcp || port=53)", action: "reject" },
    ] });
    await reloaded;
    yield create(RuleListSchema);
    await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
  });
  const stop = daemon.rules.subscribe(() => {});
  try {
    await vi.waitFor(() => expect(daemon.rules.getSnapshot().data.rules).toHaveLength(2));
    expect(daemon.rules.getSnapshot().data.rules.map((rule) => rule.action)).toEqual(["route", "reject"]);
    reload?.();
    await vi.waitFor(() => expect(daemon.rules.getSnapshot().data.rules).toHaveLength(0));
    expect(daemon.rules.getSnapshot().data.loaded).toBe(true);
  } finally {
    reload?.();
    stop();
  }
  expect(signal?.aborted).toBe(true);
});
