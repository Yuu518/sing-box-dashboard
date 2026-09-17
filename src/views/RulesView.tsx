import { useState } from "react";

import { useStream } from "../api/stream";
import { useSupportsCapability } from "../app/capabilities";
import { useApi } from "../app/context";
import { useI18n } from "../app/i18n";
import { PageHeader } from "../components/PageHeader";
import { StreamStates } from "../components/StreamBanner";
import { Badge, Card } from "../components/ui";
import { cx } from "../lib/cx";
import groupStyles from "./GroupsView.module.css";
import { RuleProvidersRefreshButton, RuleProvidersView, useRuleProviders } from "./RuleProvidersView";
import styles from "./RulesView.module.css";

export function RulesView() {
  const api = useApi();
  const { t } = useI18n();
  const rules = useStream(api.rules);
  const providers = useRuleProviders();
  const supportsRules = useSupportsCapability("rules");
  const supportsProviders = useSupportsCapability("ruleProviders");
  const [activeTab, setActiveTab] = useState<"rules" | "providers">("rules");
  const showingProviders = supportsProviders && (!supportsRules || activeTab === "providers");

  return (
    <div className="page">
      <PageHeader title={t("Rules")} />
      <div className={groupStyles.groupToolbar}>
        <div className={cx("segmented", groupStyles.groupTabs)} role="group" aria-label={t("Rules")}>
          {supportsRules && (
            <button
              type="button"
              className={!showingProviders ? "active" : ""}
              aria-pressed={!showingProviders}
              onClick={() => setActiveTab("rules")}
            >
              {t("Rules")}{rules.data.loaded ? ` (${rules.data.rules.length})` : ""}
            </button>
          )}
          {supportsProviders && (
            <button
              type="button"
              className={showingProviders ? "active" : ""}
              aria-pressed={showingProviders}
              onClick={() => setActiveTab("providers")}
            >
              {t("Rule sets")}{providers.snapshot.data.loaded ? ` (${providers.snapshot.data.providers.length})` : ""}
            </button>
          )}
        </div>
        {showingProviders && <RuleProvidersRefreshButton state={providers} />}
      </div>
      {showingProviders ? <RuleProvidersView state={providers} /> : (
        <>
          <StreamStates
            snapshot={rules}
            loaded={rules.data.loaded}
            empty={rules.data.rules.length === 0}
            emptyIcon="folder"
            emptyMessage={t("No rules")}
          />
          {rules.data.rules.map((rule, index) => (
            <Card
              key={index}
              className={styles.rule}
              title={
                <span className={styles.heading}>
                  <span className={styles.index}>#{index + 1}</span>
                  <span className={styles.type}>{rule.type.toUpperCase()}</span>
                  {rule.action && <Badge>{rule.action}</Badge>}
                </span>
              }
            >
              <p className={styles.condition}>{rule.condition || t("All traffic")}</p>
              {rule.actionDescription && <p className={styles.action}>{rule.actionDescription}</p>}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
