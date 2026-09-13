import { fromBinary } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";

import { VersionSchema } from "../gen/daemon/started_service_pb";
import { makeCapabilities } from "./capabilities";

describe("provider capability", () => {
  it("does not infer provider support from the API version", () => {
    expect(makeCapabilities(null).supports("proxyProviders")).toBe(false);
    expect(makeCapabilities(4).supports("proxyProviders")).toBe(false);
    expect(makeCapabilities(999).supports("proxyProviders")).toBe(false);
    expect(makeCapabilities(4, false).supports("proxyProviders")).toBe(false);
    expect(makeCapabilities(4, true).supports("proxyProviders")).toBe(true);
    expect(makeCapabilities(null, true).supports("proxyProviders")).toBe(false);
  });

  it("treats legacy version responses as unsupported", () => {
    const legacy = fromBinary(VersionSchema, new Uint8Array([0x10, 4]));
    expect(makeCapabilities(legacy.apiVersion, legacy.proxyProvidersSupported).supports("proxyProviders")).toBe(false);
    const supported = fromBinary(VersionSchema, new Uint8Array([0x10, 4, 0x18, 1]));
    expect(makeCapabilities(supported.apiVersion, supported.proxyProvidersSupported).supports("proxyProviders")).toBe(true);
  });

  it("preserves version checks for existing features", () => {
    expect(makeCapabilities(3).supports("taildrop")).toBe(false);
    expect(makeCapabilities(4).supports("taildrop")).toBe(true);
    expect(makeCapabilities(2).supports("usbip")).toBe(true);
  });
});
