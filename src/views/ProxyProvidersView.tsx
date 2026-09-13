import { useId, useState } from "react";

import { formatBytes, formatDateTime, formatRelativeTime, proxyDisplayDescription, urlTestDelayTone } from "../api/format";
import { useStream } from "../api/stream";
import { useApi, useNow } from "../app/context";
import { showError } from "../app/errorStore";
import { useI18n } from "../app/i18n";
import { useURLTestPreferences } from "../app/useURLTestPreferences";
import { StreamStates } from "../components/StreamBanner";
import { Icon } from "../components/Icon";
import { Card, EmptyState, IconButton, Spinner } from "../components/ui";
import type { GroupItem, ProxyProvider } from "../gen/daemon/started_service_pb";
import { cx } from "../lib/cx";
import groupStyles from "./GroupsView.module.css";
import styles from "./ProxyProvidersView.module.css";

export function ProxyProvidersTabLabel() {
  const api = useApi();
  const { t } = useI18n();
  const snapshot = useStream(api.proxyProviders);
  return <>{t("Proxy providers")}{snapshot.data.loaded ? ` (${snapshot.data.providers.length})` : ""}</>;
}

export function ProxyProvidersRefreshButton({ updating, onUpdate }: { updating: boolean; onUpdate: () => void }) {
  const api = useApi();
  const { t } = useI18n();
  const snapshot = useStream(api.proxyProviders);
  return (
    <IconButton
      title={t("Update all subscriptions")}
      aria-label={t("Update all subscriptions")}
      aria-busy={updating}
      disabled={updating || !snapshot.data.loaded || !snapshot.data.providers.some((provider) => provider.updatable)}
      onClick={onUpdate}
    >
      {updating ? <Spinner /> : <Icon name="sync" />}
    </IconButton>
  );
}

export function ProxyProvidersView({ updating = false }: { updating?: boolean }) {
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
      {snapshot.data.providers.map((provider) => <ProviderCard key={provider.tag} provider={provider} updating={updating} />)}
    </div>
  );
}

function ProviderCard({ provider, updating }: { provider: ProxyProvider; updating: boolean }) {
  const api = useApi();
  const { t, language } = useI18n();
  const preferences = useURLTestPreferences();
  const now = useNow();
  const nodesId = useId();
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<"update" | "test" | null>(null);
  const run = (operation: "update" | "test") => {
    if (pending || updating) return;
    setPending(operation);
    const request = operation === "update"
      ? api.updateProxyProvider(provider.tag)
      : api.healthCheckProxyProvider(provider.tag);
    request.catch(showError).finally(() => setPending(null));
  };
  const subscription = provider.subscription;
  const used = subscription ? subscription.upload + subscription.download : 0n;
  const tested = provider.outbounds.filter((item) => item.urlTestTime > 0n || item.urlTestDelay > 0).length;
  return (
    <section
      className={cx(groupStyles.groupCard, expanded && groupStyles.expanded, styles.provider)}
      aria-label={provider.tag}
      onClick={(event) => {
        const target = event.target;
        if (
          !(target instanceof Element) ||
          !event.currentTarget.contains(target) ||
          target.closest("button, a, input, select, textarea, [role='button']")
        ) {
          return;
        }
        setExpanded((value) => !value);
      }}
    >
      <Card
        title={
          <button
            type="button"
            className={styles.heading}
            aria-expanded={expanded}
            aria-controls={nodesId}
            onClick={() => setExpanded((value) => !value)}
          >
            <span className={styles.title}>{provider.tag}</span>
            <span className={styles.headingMeta}>
              {provider.type.toUpperCase()}
              <span aria-hidden="true"> · </span>
              <span title={t("{count} nodes ({tested} tested)", { count: provider.outbounds.length, tested })}>{tested}/{provider.outbounds.length}</span>
            </span>
          </button>
        }
        actions={
          <>
            <IconButton title={t("URL test")} aria-label={`${t("URL test")}: ${provider.tag}`} disabled={updating || pending !== null || provider.outbounds.length === 0} onClick={() => run("test")}>
              {pending === "test" ? <Spinner /> : <Icon name="bolt" size={16} />}
            </IconButton>
            {provider.updatable && (
              <IconButton title={t("Update")} aria-label={`${t("Update")}: ${provider.tag}`} disabled={updating || pending !== null} onClick={() => run("update")}>
                {pending === "update" ? <Spinner /> : <Icon name="sync" size={16} />}
              </IconButton>
            )}
          </>
        }
      >
        {subscription && (used > 0n || subscription.total > 0n) && (
          <p className={styles.meta}>
            {formatBytes(used)}
            {subscription.total > 0n && (
              <> / {formatBytes(subscription.total)} ({(Number(used) / Number(subscription.total) * 100).toLocaleString(language, { maximumFractionDigits: 2 })}%)</>
            )}
          </p>
        )}
        <p className={styles.meta} title={provider.updatedAt > 0n ? formatDateTime(Number(provider.updatedAt), language) : undefined}>
          {t("Updated {time}", { time: provider.updatedAt > 0n ? formatRelativeTime(Math.min(Number(provider.updatedAt), now), now, language) : t("Unknown") })}
        </p>
        {subscription && subscription.expire > 0n && (
          <p className={styles.meta}>{t("Expires {time}", { time: formatDateTime(Number(subscription.expire) * 1000, language) })}</p>
        )}
        {!expanded && (
          <div className={styles.dots} role="list" aria-label={t("Proxies")}>
            {provider.outbounds.map((item) => {
              const status = `${item.tag}: ${item.urlTestDelay > 0 ? `${item.urlTestDelay}ms` : t("Unknown")}`;
              return <span key={item.tag} role="listitem" className={styles.dot} data-tone={urlTestDelayTone(item.urlTestDelay, preferences)} title={status} aria-label={status} />;
            })}
          </div>
        )}
        <div id={nodesId} className={styles.nodes} hidden={!expanded}>
          {provider.outbounds.length === 0 && <EmptyState icon="folder">{t("Empty groups")}</EmptyState>}
          <div className={groupStyles.groupItems}>
            {provider.outbounds.map((item) => <ProviderNode key={item.tag} item={item} />)}
          </div>
        </div>
      </Card>
    </section>
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
    <div className={cx(groupStyles.groupItem, styles.node)} onClick={(event) => event.stopPropagation()}>
      <span className={groupStyles.itemTag} title={item.tag}>{item.tag}</span>
      <span className={groupStyles.itemMeta}>
        <span>{proxyDisplayDescription(item, preferences.ipv6Test)}</span>
        <button
          type="button"
          className={cx(groupStyles.delayText, groupStyles[urlTestDelayTone(item.urlTestDelay, preferences)])}
          title={`${t("URL test")}: ${item.tag}`}
          aria-label={`${t("URL test")}: ${item.tag}`}
          disabled={testing}
          onClick={run}
        >
          {testing ? <Spinner /> : item.urlTestDelay > 0 ? item.urlTestDelay : <Icon name="bolt" size={12} />}
        </button>
      </span>
    </div>
  );
}
