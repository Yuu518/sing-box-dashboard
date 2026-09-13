import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { EmptySchema } from "@bufbuild/protobuf/wkt";
import { afterEach, expect, it, vi } from "vitest";

import { URLTestRequestSchema } from "../gen/daemon/started_service_pb";
import { DaemonApi } from "./daemon";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("uses the latest saved IPv6 setting for each node or group test", async () => {
  let stored: string | null = null;
  vi.stubGlobal("localStorage", { getItem: () => stored });
  const api = new DaemonApi({ id: "test", name: "test", url: "http://localhost", secret: "" }, "en");
  const request = vi.spyOn(api.client, "uRLTest").mockResolvedValue(create(EmptySchema));

  await api.urlTest("node");
  expect(request).toHaveBeenLastCalledWith({ outboundTag: "node", ipv6Test: false });
  stored = JSON.stringify({ ipv6Test: true });
  await api.urlTest("group");
  expect(request).toHaveBeenLastCalledWith({ outboundTag: "group", ipv6Test: true });
  stored = JSON.stringify({ ipv6Test: false });
  await api.urlTest("node");
  expect(request).toHaveBeenLastCalledWith({ outboundTag: "node", ipv6Test: false });
});

it("encodes the IPv6 request flag and defaults legacy requests to disabled", () => {
  const legacy = fromBinary(URLTestRequestSchema, new Uint8Array([0x0a, 1, 0x61]));
  expect(legacy.outboundTag).toBe("a");
  expect(legacy.ipv6Test).toBe(false);
  const encoded = toBinary(URLTestRequestSchema, create(URLTestRequestSchema, { outboundTag: "a", ipv6Test: true }));
  expect(fromBinary(URLTestRequestSchema, encoded).ipv6Test).toBe(true);
});
