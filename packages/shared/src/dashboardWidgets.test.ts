import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_WIDGET_IDS,
  DASHBOARD_WIDGETS,
  dashboardWidgetsPatchSchema,
  hasAnyEnabledDashboardWidget,
  needsDashboardDetails,
  mergeDashboardWidgetPatch,
  parseStoredDashboardWidgets,
  resolveDashboardWidgets,
  effectiveDashboardWidgets,
  availableDashboardWidgets,
  type DashboardWidgetsState,
} from "./dashboardWidgets.js";

describe("resolveDashboardWidgets", () => {
  it("uses registry defaults when stored is null", () => {
    const resolved = resolveDashboardWidgets(null);
    assert.equal(resolved["net-worth"], true);
    assert.equal(resolved["recent-transactions"], true);
    assert.equal(resolved["credit-cards"], false);
    assert.equal(Object.keys(resolved).length, DASHBOARD_WIDGETS.length);
  });

  it("applies known overrides and ignores unknown ids", () => {
    const resolved = resolveDashboardWidgets({
      "net-worth": false,
      "not-a-widget": true,
      "recent-transactions": "yes",
    });
    assert.equal(resolved["net-worth"], false);
    assert.equal(resolved["recent-transactions"], true);
  });

  it("ignores arrays and non-objects", () => {
    assert.equal(resolveDashboardWidgets([])["net-worth"], true);
    assert.equal(resolveDashboardWidgets("x")["recent-transactions"], true);
  });

  it("expands the legacy household-summary into its parts", () => {
    const resolved = resolveDashboardWidgets({ "household-summary": false });
    assert.equal(resolved["net-worth"], false);
    assert.equal(resolved["per-person"], false);
    assert.equal(resolved["recent-transactions"], true);
  });

  it("lets an explicit part win over the legacy household-summary", () => {
    const resolved = resolveDashboardWidgets({
      "household-summary": false,
      "per-person": true,
    });
    assert.equal(resolved["per-person"], true);
    assert.equal(resolved["net-worth"], false);
  });
});

describe("parseStoredDashboardWidgets", () => {
  it("keeps only boolean values for known ids", () => {
    const parsed = parseStoredDashboardWidgets({
      "net-worth": false,
      "recent-transactions": 1,
    });
    assert.deepEqual(parsed, { "net-worth": false });
  });
});

describe("mergeDashboardWidgetPatch", () => {
  it("merges a partial patch onto stored overrides", () => {
    const merged = mergeDashboardWidgetPatch(
      { "net-worth": false },
      { "recent-transactions": false },
    );
    assert.deepEqual(merged, {
      "net-worth": false,
      "recent-transactions": false,
    });
  });

  it("replaces the legacy id with its parts when saving", () => {
    const merged = mergeDashboardWidgetPatch(
      { "household-summary": false },
      { "per-person": true },
    );
    assert.deepEqual(merged, {
      "net-worth": false,
      "per-person": true,
    });
  });
});

describe("dashboardWidgetsPatchSchema", () => {
  it("accepts every registered id and rejects unknown ones", () => {
    const patch = Object.fromEntries(DASHBOARD_WIDGET_IDS.map((id) => [id, false]));
    assert.equal(dashboardWidgetsPatchSchema.safeParse(patch).success, true);
    assert.equal(
      dashboardWidgetsPatchSchema.safeParse({ "household-summary": false }).success,
      false,
    );
  });
});

describe("needsDashboardDetails", () => {
  it("skips the extra fetch on the default dashboard", () => {
    assert.equal(needsDashboardDetails(resolveDashboardWidgets(null)), false);
  });

  it("skips it for extras served by the summary", () => {
    assert.equal(
      needsDashboardDetails(resolveDashboardWidgets({ "credit-cards": true })),
      false,
    );
  });

  it("asks for it when a detail widget is on", () => {
    assert.equal(needsDashboardDetails(resolveDashboardWidgets({ investments: true })), true);
  });
});

describe("hasAnyEnabledDashboardWidget", () => {
  it("is false when every registered widget is off", () => {
    const allOff = Object.fromEntries(
      DASHBOARD_WIDGET_IDS.map((id) => [id, false]),
    ) as DashboardWidgetsState;
    assert.equal(hasAnyEnabledDashboardWidget(allOff), false);
    assert.equal(hasAnyEnabledDashboardWidget(resolveDashboardWidgets(null)), true);
  });
});

describe("blocos de módulos", () => {
  it("esconde Investimentos com o módulo desligado, mesmo se o bloco estiver ligado", () => {
    const state = resolveDashboardWidgets({ investments: true });
    const off = effectiveDashboardWidgets(state, { investments: false, assistant: false });
    assert.equal(off.investments, false);
    assert.equal(needsDashboardDetails(off), false);
    const on = effectiveDashboardWidgets(state, { investments: true, assistant: false });
    assert.equal(on.investments, true);
  });

  it("só lista nos Ajustes os blocos de módulos ligados", () => {
    const ids = availableDashboardWidgets({ investments: false, assistant: false }).map((w) => w.id);
    assert.equal(ids.includes("investments"), false);
    assert.equal(ids.includes("recent-transactions"), true);
  });
});
