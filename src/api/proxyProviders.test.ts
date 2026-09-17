import { create } from "@bufbuild/protobuf";
import { EmptySchema } from "@bufbuild/protobuf/wkt";
import { Code } from "@connectrpc/connect";
import { afterEach, expect, it, vi } from "vitest";

import { ProxyProviderListSchema } from "../gen/daemon/started_service_pb";
import { DaemonApi } from "./daemon";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function api() {
  return new DaemonApi({ id: "test", name: "test", url: "http://localhost", secret: "" }, "en");
}

it("sends provider operations and current probe preferences", async () => {
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ ipv6Test: true, url: "https://example.com/check", timeoutMs: 2700 }) });
  const daemon = api();
  const update = vi.spyOn(daemon.client, "updateProxyProvider").mockResolvedValue(create(EmptySchema));
  const health = vi.spyOn(daemon.client, "healthCheckProxyProvider").mockResolvedValue(create(EmptySchema));
  await daemon.updateProxyProvider("subscription");
  await daemon.healthCheckProxyProvider("subscription");
  expect(update).toHaveBeenCalledWith({ tag: "subscription" });
  expect(health).toHaveBeenCalledWith({ tag: "subscription", ipv6Test: true, url: "https://example.com/check", timeoutMs: 2700 });
});

it("does not subscribe on unsupported servers", async () => {
  const daemon = api();
  vi.spyOn(daemon, "serverInfo").mockResolvedValue({ version: "old", apiVersion: 4, proxyProvidersSupported: false, ruleProvidersSupported: false });
  const subscribe = vi.spyOn(daemon.client, "subscribeProxyProviders");
  const stop = daemon.proxyProviders.subscribe(() => {});
  try {
    await vi.waitFor(() => expect(daemon.proxyProviders.getSnapshot().errorCode).toBe(Code.Unimplemented));
    expect(subscribe).not.toHaveBeenCalled();
  } finally {
    stop();
  }
});

it("publishes provider snapshots and cancels the stream when the view closes", async () => {
  const daemon = api();
  vi.spyOn(daemon, "serverInfo").mockResolvedValue({ version: "new", apiVersion: 5, proxyProvidersSupported: true, ruleProvidersSupported: false });
  let signal: AbortSignal | undefined;
  vi.spyOn(daemon.client, "subscribeProxyProviders").mockImplementation(async function* (_, options) {
    signal = options?.signal;
    yield create(ProxyProviderListSchema, { providers: [{ tag: "subscription", outbounds: [{ tag: "node", udp: true }] }] });
    await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
  });
  const stop = daemon.proxyProviders.subscribe(() => {});
  try {
    await vi.waitFor(() => expect(daemon.proxyProviders.getSnapshot().data.loaded).toBe(true));
    expect(daemon.proxyProviders.getSnapshot().data.providers[0].outbounds[0].udp).toBe(true);
  } finally {
    stop();
  }
  expect(signal?.aborted).toBe(true);
});
