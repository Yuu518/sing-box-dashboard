import { useState } from "react";

import { formatBytes, formatDateTime, proxyDisplayDescription, urlTestDelayTone } from "../api/format";
import { useStream } from "../api/stream";
import { useApi } from "../app/context";
import { showError } from "../app/errorStore";
import { useI18n } from "../app/i18n";
import { useURLTestPreferences } from "../app/useURLTestPreferences";
import { StreamStates } from "../components/StreamBanner";
import { Badge, Button, Card, DataLine, EmptyState, Spinner } from "../components/ui";
import type { GroupItem, ProxyProvider } from "../gen/daemon/started_service_pb";
import styles from "./ProxyProvidersView.module.css";

export function ProxyProvidersView() {
  const api = useApi();
  const { t } = useI18n();
  const snapshot = useStream(api.proxyProviders);
  return (
    <div className={styles.providers}>
      <StreamStates
        snapshot={snapshot}
        loaded={snapshot.data.loaded}
        empty={snapshot.data.providers.length === 0}
        emptyIcon="folder"
        emptyMessage={t("No proxy provider data")}
      />
      {snapshot.data.providers.map((provider) => <ProviderCard key={provider.tag} provider={provider} />)}
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProxyProvider }) {
  const api = useApi();
  const { t } = useI18n();
  const [pending, setPending] = useState<"update" | "test" | null>(null);
  const run = (operation: "update" | "test") => {
    if (pending) return;
    setPending(operation);
    const request = operation === "update"
      ? api.updateProxyProvider(provider.tag)
      : api.healthCheckProxyProvider(provider.tag);
    request.catch(showError).finally(() => setPending(null));
  };
  const subscription = provider.subscription;
  return (
    <Card
      title={provider.tag}
      actions={
        <>
          <Badge>{provider.outbounds.length}</Badge>
          {provider.updatable && (
            <Button size="small" disabled={pending !== null} onClick={() => run("update")}>
              {pending === "update" && <Spinner />}{t("Update")}
            </Button>
          )}
          <Button size="small" disabled={pending !== null || provider.outbounds.length === 0} onClick={() => run("test")}>
            {pending === "test" && <Spinner />}{t("URL test")}
          </Button>
        </>
      }
    >
      <DataLine label={t("Type")} value={provider.type} />
      <DataLine label={t("Last Updated")} value={provider.updatedAt > 0n ? formatDateTime(Number(provider.updatedAt)) : t("Unknown")} />
      {subscription && (
        <>
          <DataLine label={t("Upload")} value={formatBytes(subscription.upload)} />
          <DataLine label={t("Download")} value={formatBytes(subscription.download)} />
          {subscription.total > 0n && (
            <DataLine label={t("Traffic")} value={`${formatBytes(subscription.upload + subscription.download)} / ${formatBytes(subscription.total)}`} />
          )}
          {subscription.expire > 0n && (
            <p>{t("Expires {time}", { time: formatDateTime(Number(subscription.expire) * 1000) })}</p>
          )}
        </>
      )}
      <details className={styles.nodes}>
        <summary>{t("Proxies")} ({provider.outbounds.length})</summary>
        {provider.outbounds.length === 0 && <EmptyState icon="folder">{t("Empty groups")}</EmptyState>}
        {provider.outbounds.map((item) => <ProviderNode key={item.tag} item={item} />)}
      </details>
    </Card>
  );
}

function ProviderNode({ item }: { item: GroupItem }) {
  const api = useApi();
  const { t } = useI18n();
  const preferences = useURLTestPreferences();
  const [testing, setTesting] = useState(false);
  const run = () => {
    if (testing) return;
    setTesting(true);
    api.urlTest(item.tag).catch(showError).finally(() => setTesting(false));
  };
  return (
    <div className={styles.node}>
      <div className={styles.description}>
        <span className={styles.name}>{item.tag}</span>
        <span className={styles.meta}>{proxyDisplayDescription(item, preferences.ipv6Test)}</span>
      </div>
      <Button size="small" disabled={testing} onClick={run} aria-label={`${t("URL test")}: ${item.tag}`}>
        {testing ? <Spinner /> : item.urlTestDelay > 0
          ? <Badge tone={urlTestDelayTone(item.urlTestDelay, preferences)}>{item.urlTestDelay}ms</Badge>
          : t("URL test")}
      </Button>
    </div>
  );
}
