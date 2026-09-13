import { useRef, useState } from "react";

import { proxyDisplayDescription, proxyDisplayType, urlTestDelayTone, type DelayTone } from "../api/format";
import { describeError, useStream } from "../api/stream";
import { useSupportsCapability } from "../app/capabilities";
import { useApi } from "../app/context";
import { showError } from "../app/errorStore";
import { usePendingValue } from "../app/hooks";
import { useI18n } from "../app/i18n";
import { useURLTestPreferences } from "../app/useURLTestPreferences";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { StreamStates } from "../components/StreamBanner";
import { Badge, Card, IconButton, MenuItem, Spinner, useContextMenu } from "../components/ui";
import type { Group, GroupItem } from "../gen/daemon/started_service_pb";
import { ProxyProvidersRefreshButton, ProxyProvidersTabLabel, ProxyProvidersView } from "./ProxyProvidersView";
import styles from "./GroupsView.module.css";
import { cx } from "../lib/cx";

export function GroupsView() {
  const api = useApi();
  const { t } = useI18n();
  const groups = useStream(api.groups);
  const [activeTab, setActiveTab] = useState<"proxies" | "providers">("proxies");
  const supportsProviders = useSupportsCapability("proxyProviders");
  const showingProviders = supportsProviders && activeTab === "providers";
  const [updatingProviders, setUpdatingProviders] = useState(false);
  const updatingProvidersRef = useRef(false);

  const updateProviders = async () => {
    if (updatingProvidersRef.current) return;
    const providers = api.proxyProviders.getSnapshot().data.providers.filter((provider) => provider.updatable);
    if (providers.length === 0) return;
    updatingProvidersRef.current = true;
    setUpdatingProviders(true);
    try {
      const results = await Promise.allSettled(providers.map((provider) => api.updateProxyProvider(provider.tag)));
      const errors = results.flatMap((result, index) => result.status === "rejected"
        ? [`${providers[index].tag}: ${describeError(result.reason).message}`]
        : []);
      if (errors.length > 0) showError(new Error(errors.join("\n")));
    } finally {
      updatingProvidersRef.current = false;
      setUpdatingProviders(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title={t("Proxies")} />
      {supportsProviders && (
        <div className={styles.groupToolbar}>
          <div className={cx("segmented", styles.groupTabs)} role="group" aria-label={t("Groups")}>
            <button
              type="button"
              className={!showingProviders ? "active" : ""}
              aria-pressed={!showingProviders}
              onClick={() => setActiveTab("proxies")}
            >
              {t("Proxies")}{groups.data.loaded ? ` (${groups.data.groups.length})` : ""}
            </button>
            <button
              type="button"
              className={showingProviders ? "active" : ""}
              aria-pressed={showingProviders}
              onClick={() => setActiveTab("providers")}
            >
              <ProxyProvidersTabLabel />
            </button>
          </div>
          {showingProviders && <ProxyProvidersRefreshButton updating={updatingProviders} onUpdate={updateProviders} />}
        </div>
      )}
      <div hidden={showingProviders}>
        <StreamStates
          snapshot={groups}
          loaded={groups.data.loaded}
          empty={groups.data.groups.length === 0}
          emptyIcon="folder"
          emptyMessage={t("Empty groups")}
        />
        {groups.data.groups.map((group) => (
          <GroupCard key={group.tag} group={group} />
        ))}
      </div>
      {showingProviders && (
        <ProxyProvidersView updating={updatingProviders} />
      )}
    </div>
  );
}

function GroupCard(props: { group: Group }) {
  const preferences = useURLTestPreferences();
  const api = useApi();
  const { t } = useI18n();
  const group = props.group;
  const [testing, setTesting] = useState(false);
  const [expanded, setExpandOverride] = usePendingValue(group.isExpand);
  const [selected, setPendingSelection] = usePendingValue(group.selected);
  const selectedDelay = group.items.find((item) => item.tag === selected)?.urlTestDelay ?? 0;

  const toggleExpand = () => {
    const next = !expanded;
    setExpandOverride(next);
    api.setGroupExpand(group.tag, next).catch(() => setExpandOverride(null));
  };

  const runURLTest = () => {
    setTesting(true);
    api
      .urlTest(group.tag)
      .catch(showError)
      .finally(() => setTesting(false));
  };

  const selectItem = (item: GroupItem) => {
    if (!group.selectable || item.tag === selected) {
      return;
    }
    setPendingSelection(item.tag);
    api.selectOutbound(group.tag, item.tag).catch((error: unknown) => {
      setPendingSelection(null);
      showError(error);
    });
  };

  return (
    <div
      className={cx(styles.groupCard, expanded && styles.expanded)}
      onClick={(event) => {
        const target = event.target;
        if (
          !(target instanceof Element) ||
          !event.currentTarget.contains(target) ||
          target.closest(`button, .${styles.groupDots}`)
        ) {
          return;
        }
        toggleExpand();
      }}
    >
      <Card
        title={
          <button
            type="button"
            className={styles.groupTitle}
            aria-expanded={expanded}
            onClick={toggleExpand}
          >
            {group.tag}
            <span style={{ marginLeft: 8, color: "var(--text-faint)", fontWeight: 500 }}>
              {proxyDisplayType(group.type)}
            </span>
          </button>
        }
        actions={
          <>
            <Badge>{group.items.length}</Badge>
            <button
              type="button"
              className={cx(styles.delayText, styles.headerDelay, styles[urlTestDelayTone(selectedDelay, preferences)])}
              title={`${t("URL test")}: ${group.tag}${selectedDelay > 0 ? ` (${selectedDelay}ms)` : ""}`}
              aria-label={`${t("URL test")}: ${group.tag}`}
              onClick={runURLTest}
              disabled={testing}
            >
              {testing ? <Spinner /> : selectedDelay > 0 ? selectedDelay : <Icon name="bolt" size={14} />}
            </button>
            <IconButton
              title={expanded ? t("Collapse") : t("Expand")}
              onClick={toggleExpand}
            >
              <Icon name={expanded ? "expand_less" : "expand_more"} />
            </IconButton>
          </>
        }
      >
        {selected !== "" && (
          <div className={styles.currentNode} title={selected}>
            {selected}
          </div>
        )}
        {expanded ? (
          <div className={styles.groupItems}>
            {group.items.map((item) => (
              <GroupItemCard
                key={item.tag}
                item={item}
                selected={item.tag === selected}
                tone={urlTestDelayTone(item.urlTestDelay, preferences)}
                ipv6Test={preferences.ipv6Test}
                onSelect={() => selectItem(item)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.groupDots}>
            {group.items.map((item) => {
              const tone = item.urlTestDelay > 0 ? urlTestDelayTone(item.urlTestDelay, preferences) : "";
              return (
                <button
                  type="button"
                  key={item.tag}
                  className={cx(styles.groupDot, styles[tone], item.tag === selected && styles.selected)}
                  title={`${item.tag}${item.urlTestDelay > 0 ? ` (${item.urlTestDelay}ms)` : ""}`}
                  aria-label={item.tag}
                  aria-pressed={item.tag === selected}
                  disabled={!group.selectable}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectItem(item);
                  }}
                />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function GroupItemCard(props: { item: GroupItem; selected: boolean; tone: DelayTone; ipv6Test: boolean; onSelect: () => void }) {
  const api = useApi();
  const { t } = useI18n();
  const item = props.item;
  const [testing, setTesting] = useState(false);
  const runURLTest = () => {
    if (testing) {
      return;
    }
    setTesting(true);
    api.urlTest(item.tag).catch(showError).finally(() => setTesting(false));
  };
  const menu = useContextMenu(
    <MenuItem icon="speed" onSelect={runURLTest}>
      {t("URL test")}
    </MenuItem>,
  );

  return (
    <>
      <div
        className={cx(styles.groupItem, props.selected && styles.selected)}
        onClick={(event) => event.stopPropagation()}
        {...menu.triggerProps}
      >
        <button
          type="button"
          className={styles.itemSelect}
          aria-label={item.tag}
          aria-pressed={props.selected}
          onClick={props.onSelect}
        />
        <span className={styles.itemTag}>{item.tag}</span>
        <span className={styles.itemMeta}>
          <span>{proxyDisplayDescription(item, props.ipv6Test)}</span>
          {item.urlTestDelay > 0 && (
            <button
              type="button"
              className={cx(styles.delayText, styles[props.tone])}
              title={`${t("URL test")}: ${item.tag}`}
              aria-label={`${t("URL test")}: ${item.tag}`}
              disabled={testing}
              onClick={(event) => {
                event.stopPropagation();
                runURLTest();
              }}
            >
              {testing ? <Spinner /> : `${item.urlTestDelay}ms`}
            </button>
          )}
        </span>
      </div>
      {menu.element}
    </>
  );
}
