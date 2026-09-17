import { useRef, useState } from "react";

import { formatDateTime, formatRelativeTime } from "../api/format";
import { describeError, useStream } from "../api/stream";
import { useApi, useNow } from "../app/context";
import { showError } from "../app/errorStore";
import { useI18n } from "../app/i18n";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StreamStates } from "../components/StreamBanner";
import { Card, IconButton, Spinner } from "../components/ui";
import type { RuleProvider } from "../gen/daemon/started_service_pb";
import styles from "./RuleProvidersView.module.css";

export function RuleProvidersView() {
  const api = useApi();
  const { t } = useI18n();
  const snapshot = useStream(api.ruleProviders);
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState(new Set<string>());
  const [updatingAll, setUpdatingAll] = useState(false);
  const update = async (providers: RuleProvider[], all = false) => {
    const tags = providers.filter((provider) => provider.updatable && !pendingRef.current.has(provider.tag)).map((provider) => provider.tag);
    if (tags.length === 0) return;
    for (const tag of tags) pendingRef.current.add(tag);
    setPending(new Set(pendingRef.current));
    if (all) setUpdatingAll(true);
    try {
      const results = await Promise.allSettled(tags.map((tag) => api.updateRuleProvider(tag)));
      const errors = results.flatMap((result, index) => result.status === "rejected"
        ? [`${tags[index]}: ${describeError(result.reason).message}`]
        : []);
      if (errors.length > 0) showError(new Error(errors.join("\n")));
    } finally {
      for (const tag of tags) pendingRef.current.delete(tag);
      setPending(new Set(pendingRef.current));
      if (all) setUpdatingAll(false);
    }
  };
  return (
    <div className="page">
      <PageHeader
        title={t("Rule sets")}
        actions={
          <IconButton
            title={t("Update all rule sets")}
            aria-label={t("Update all rule sets")}
            aria-busy={updatingAll}
            disabled={pending.size > 0 || !snapshot.data.loaded || !snapshot.data.providers.some((provider) => provider.updatable)}
            onClick={() => void update(snapshot.data.providers, true)}
          >
            {updatingAll ? <Spinner /> : <Icon name="sync" />}
          </IconButton>
        }
      />
      <StreamStates
        snapshot={snapshot}
        loaded={snapshot.data.loaded}
        empty={snapshot.data.providers.length === 0}
        emptyIcon="folder"
        emptyMessage={t("No rule sets")}
      />
      {snapshot.data.providers.map((provider) => (
        <RuleProviderCard key={provider.tag} provider={provider} pending={pending.has(provider.tag)} onUpdate={() => void update([provider])} />
      ))}
    </div>
  );
}

function RuleProviderCard({ provider, pending, onUpdate }: { provider: RuleProvider; pending: boolean; onUpdate: () => void }) {
  const { t, language } = useI18n();
  const now = useNow();
  return (
    <Card
      className={styles.provider}
      title={
        <span className={styles.heading}>
          <span className={styles.title}>{provider.tag}</span>
          <span className={styles.headingMeta}>
            {provider.type.toUpperCase()}
            {provider.format && <> · {provider.format.toUpperCase()}</>}
          </span>
        </span>
      }
      actions={provider.updatable && (
        <IconButton title={t("Update")} aria-label={`${t("Update")}: ${provider.tag}`} aria-busy={pending} disabled={pending} onClick={onUpdate}>
          {pending ? <Spinner /> : <Icon name="sync" size={16} />}
        </IconButton>
      )}
    >
      <p className={styles.meta}>{t("{count} rules", { count: provider.ruleCount.toLocaleString(language) })}</p>
      <p className={styles.meta} title={provider.updatedAt > 0n ? formatDateTime(Number(provider.updatedAt), language) : undefined}>
        {t("Updated {time}", { time: provider.updatedAt > 0n ? formatRelativeTime(Math.min(Number(provider.updatedAt), now), now, language) : t("Unknown") })}
      </p>
    </Card>
  );
}
