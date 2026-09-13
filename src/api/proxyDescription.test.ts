import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";

import { GroupItemSchema } from "../gen/daemon/started_service_pb";
import { proxyDisplayDescription } from "./format";

describe("proxy capability descriptions", () => {
  it("accepts legacy group items without capability fields", () => {
    // Field 2 (type) is the only field in this legacy protobuf message.
    const type = new TextEncoder().encode("shadowsocks");
    const item = fromBinary(GroupItemSchema, new Uint8Array([0x12, type.length, ...type]));
    expect(item.udp).toBe(false);
    expect(item.xudp).toBe(false);
    expect(item.ipv6).toBe(false);
    expect(proxyDisplayDescription(item)).toBe("ss");
    expect(proxyDisplayDescription(item, true)).toBe("ss");
    expect(proxyDisplayDescription({ type: "shadowsocks" })).toBe("ss");
  });

  it.each([
    { udp: true, xudp: false, label: "ss / udp" },
    { udp: true, xudp: true, label: "ss / xudp" },
    { udp: false, xudp: true, label: "ss" },
  ])("decodes UDP=$udp and XUDP=$xudp as $label", ({ udp, xudp, label }) => {
    const encoded = toBinary(GroupItemSchema, create(GroupItemSchema, { type: "shadowsocks", udp, xudp }));
    expect(proxyDisplayDescription(fromBinary(GroupItemSchema, encoded))).toBe(label);
  });

  it("shows IPv6 only for positive results while the setting is enabled", () => {
    const item = create(GroupItemSchema, { type: "shadowsocks", udp: true, ipv6: true });
    const decoded = fromBinary(GroupItemSchema, toBinary(GroupItemSchema, item));
    expect(proxyDisplayDescription(decoded, true)).toBe("ss / udp / IPv6");
    expect(proxyDisplayDescription(decoded, false)).toBe("ss / udp");
    decoded.ipv6 = false;
    expect(proxyDisplayDescription(decoded, true)).toBe("ss / udp");
    expect(proxyDisplayDescription({ type: "shadowsocks", ipv6: true }, true)).toBe("ss / IPv6");
  });
});
