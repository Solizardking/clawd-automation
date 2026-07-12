/**
 * Survival package unit tests — real exported functions, mock network edges only.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  applyTierRestrictions,
  recordTransition,
  canRunInference,
  getModelForTier,
} from "../survival/low-compute.js";
import { checkResources, formatResourceReport } from "../survival/monitor.js";
import { executeFundingStrategies } from "../survival/funding.js";
import { getSurvivalTier } from "../conway/credits.js";
import {
  MockConwayClient,
  MockInferenceClient,
  createTestDb,
  createTestIdentity,
  createTestConfig,
} from "./mocks.js";
import type { AutomatonDatabase } from "../types.js";

describe("Survival package", () => {
  let db: AutomatonDatabase;
  let conway: MockConwayClient;
  let inference: MockInferenceClient;

  beforeEach(() => {
    db = createTestDb();
    conway = new MockConwayClient();
    inference = new MockInferenceClient();
  });

  afterEach(() => {
    db.close();
  });

  describe("getSurvivalTier / canRunInference / getModelForTier", () => {
    it("maps credit thresholds to tiers", () => {
      expect(getSurvivalTier(100)).toBe("normal");
      expect(getSurvivalTier(51)).toBe("normal");
      expect(getSurvivalTier(50)).toBe("low_compute");
      expect(getSurvivalTier(11)).toBe("low_compute");
      expect(getSurvivalTier(10)).toBe("critical");
      expect(getSurvivalTier(1)).toBe("critical");
      expect(getSurvivalTier(0)).toBe("dead");
    });

    it("blocks inference only when dead", () => {
      expect(canRunInference("normal")).toBe(true);
      expect(canRunInference("low_compute")).toBe(true);
      expect(canRunInference("critical")).toBe(true);
      expect(canRunInference("dead")).toBe(false);
    });

    it("selects cheaper models under pressure", () => {
      expect(getModelForTier("normal", "gpt-4o")).toBe("gpt-4o");
      expect(getModelForTier("low_compute", "gpt-4o")).toBe("gpt-4o-mini");
      expect(getModelForTier("critical", "gpt-4o")).toBe("gpt-4o-mini");
    });
  });

  describe("applyTierRestrictions", () => {
    it("enables low-compute mode and stores current_tier", () => {
      applyTierRestrictions("critical", inference, db);
      expect(inference.lowComputeMode).toBe(true);
      expect(db.getKV("current_tier")).toBe("critical");

      applyTierRestrictions("normal", inference, db);
      expect(inference.lowComputeMode).toBe(false);
      expect(db.getKV("current_tier")).toBe("normal");
    });
  });

  describe("recordTransition", () => {
    it("appends transition history in KV", () => {
      const t = recordTransition(db, "normal", "low_compute", 40);
      expect(t.from).toBe("normal");
      expect(t.to).toBe("low_compute");
      expect(t.creditsCents).toBe(40);

      const history = JSON.parse(db.getKV("tier_transitions") || "[]");
      expect(history.length).toBe(1);
      expect(history[0].to).toBe("low_compute");
    });
  });

  describe("checkResources", () => {
    it("returns tier, financial state, and sandbox health via real monitor", async () => {
      conway.creditsCents = 25;
      const identity = createTestIdentity();
      const status = await checkResources(identity, conway, db);

      expect(status.tier).toBe("low_compute");
      expect(status.financial.creditsCents).toBe(25);
      expect(status.sandboxHealthy).toBe(true);
      expect(db.getKV("current_tier")).toBe("low_compute");
      expect(conway.execCalls.some((c) => c.command === "echo ok")).toBe(true);

      const report = formatResourceReport(status);
      expect(report).toContain("RESOURCE STATUS");
      expect(report).toContain("low_compute");
    });

    it("detects tier change from previous KV", async () => {
      db.setKV("current_tier", "normal");
      conway.creditsCents = 5;
      const status = await checkResources(createTestIdentity(), conway, db);
      expect(status.tier).toBe("critical");
      expect(status.tierChanged).toBe(true);
      expect(status.previousTier).toBe("normal");
    });
  });

  describe("executeFundingStrategies", () => {
    it("records low_compute funding notice when due", async () => {
      conway.creditsCents = 30;
      const attempts = await executeFundingStrategies(
        "low_compute",
        createTestIdentity(),
        createTestConfig(),
        db,
        conway,
      );

      expect(attempts.length).toBeGreaterThanOrEqual(1);
      expect(attempts[0].strategy).toBe("polite_creator_notification");
      expect(db.getKV("funding_notice_low")).toBeDefined();
      expect(db.getKV("last_funding_request")).toBeDefined();
    });

    it("records critical notice on critical tier", async () => {
      conway.creditsCents = 5;
      const attempts = await executeFundingStrategies(
        "critical",
        createTestIdentity(),
        createTestConfig(),
        db,
        conway,
      );
      expect(attempts.some((a) => a.strategy === "urgent_local_notice")).toBe(
        true,
      );
      expect(db.getKV("funding_notice_critical")).toBeDefined();
    });
  });
});
