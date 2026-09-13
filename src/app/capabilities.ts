import { createContext, useContext } from "react";

export const MIN_API_VERSION = {
  usbip: 2,
  openVpnAndOpenConnect: 3,
  taildrop: 4,
} as const;

export type Capability = keyof typeof MIN_API_VERSION | "proxyProviders";

export interface ServerCapabilities {
  ready: boolean;
  supports(capability: Capability): boolean;
}

export function makeCapabilities(apiVersion: number | null, proxyProvidersSupported = false): ServerCapabilities {
  return {
    ready: apiVersion !== null,
    supports: (capability) => apiVersion !== null && (
      capability === "proxyProviders" ? proxyProvidersSupported : apiVersion >= MIN_API_VERSION[capability]
    ),
  };
}

export const CapabilitiesContext = createContext<ServerCapabilities>(makeCapabilities(null));

export function useSupportsCapability(capability: Capability): boolean {
  return useContext(CapabilitiesContext).supports(capability);
}
