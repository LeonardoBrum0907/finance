import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_WIDGETS,
  hasAnyEnabledDashboardWidget,
  mergeDashboardWidgetPatch,
  parseStoredDashboardWidgets,
  resolveDashboardWidgets,
} from "./dashboardWidgets.js";

describe("resolveDashboardWidgets", () => {
  it("uses registry defaults when stored is null", () => {
    const resolved = resolveDashboardWidgets(null);
    assert.equal(resolved["household-summary"], true);
    assert.equal(resolved["recent-transactions"], true);
    assert.equal(Object.keys(resolved).length, DASHBOARD_WIDGETS.length);
  });

  it("applies known overrides and ignores unknown ids", () => {
    const resolved = resolveDashboardWidgets({
      "household-summary": false,
      "not-a-widget": true,
      "recent-transactions": "yes",
    });
    assert.equal(resolved["household-summary"], false);
    assert.equal(resolved["recent-transactions"], true);
  });

  it("ignores arrays and non-objects", () => {
    assert.equal(resolveDashboardWidgets([] )["household-summary"], true);
    assert.equal(resolveDashboardWidgets("x")["recent-transactions"], true);
  });
});

describe("parseStoredDashboardWidgets", () => {
  it("keeps only boolean values for known ids", () => {
    const parsed = parseStoredDashboardWidgets({
      "household-summary": false,
      "recent-transactions": 1,
    });
    assert.deepEqual(parsed, { "household-summary": false });
  });
});

describe("mergeDashboardWidgetPatch", () => {
  it("merges a partial patch onto stored overrides", () => {
    const merged = mergeDashboardWidgetPatch(
      { "household-summary": false },
      { "recent-transactions": false },
    );
    assert.deepEqual(merged, {
      "household-summary": false,
      "recent-transactions": false,
    });
  });
});

describe("hasAnyEnabledDashboardWidget", () => {
  it("is false when every registered widget is off", () => {
    assert.equal(
      hasAnyEnabledDashboardWidget({
        "household-summary": false,
        "recent-transactions": false,
      }),
      false,
    );
    assert.equal(hasAnyEnabledDashboardWidget(resolveDashboardWidgets(null)), true);
  });
});
