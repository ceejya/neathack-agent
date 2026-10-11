import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateSalesRecords, parseSalesCsvText } from "../src/tools/validate-sales.js";
import { calculateSummaryMetrics, groupSalesByMonth } from "../src/tools/calculate-metrics.js";
import { compareSalesPeriods } from "../src/tools/compare-periods.js";
import { analyzeProductPerformance, analyzeProductPeriodChange } from "../src/tools/analyze-products.js";
import { verifyAgentFindings } from "../src/tools/verify-findings.js";
import { runSalesInvestigation } from "../src/agent/orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("SalesPulse AI - Deterministic Sales Analysis Tests", () => {
  it("correctly calculates revenue and excludes cancelled orders", () => {
    const rawSales = [
      { date: "2026-01-05", product: "Rice", quantity: 10, unit_price: 3000, status: "completed" },
      { date: "2026-01-06", product: "Oil", quantity: 5, unit_price: 2000, status: "completed" },
      { date: "2026-01-07", product: "Rice", quantity: 4, unit_price: 3000, status: "cancelled" },
    ];

    const { validSales } = validateSalesRecords(rawSales);
    const metrics = calculateSummaryMetrics(validSales);

    // Expected: (10 * 3000) + (5 * 2000) = 40,000 completed revenue.
    // Cancelled: (4 * 3000) = 12,000 cancelled revenue.
    assert.equal(metrics.totalRevenue, 40000);
    assert.equal(metrics.cancelledRevenue, 12000);
    assert.equal(metrics.completedOrdersCount, 2);
    assert.equal(metrics.cancelledOrdersCount, 1);
    assert.equal(metrics.totalOrdersCount, 3);
    assert.equal(metrics.totalUnitsSold, 15);
    assert.equal(metrics.averageOrderValue, 20000);
    assert.ok(metrics.cancellationRatePercent > 33 && metrics.cancellationRatePercent < 34);
    assert.match(metrics.profitDisclaimer, /profit and profit margin cannot be calculated/i);
  });

  it("handles missing and malformed values gracefully", () => {
    const malformed = [
      { date: "invalid-date", product: "Rice", quantity: 10, unit_price: 1000 },
      { date: "2026-01-01", product: "", quantity: 5, unit_price: 1000 },
      { date: "2026-01-02", product: "Oil", quantity: -2, unit_price: 1000 },
      { date: "2026-01-03", product: "Sugar", quantity: "abc", unit_price: 1000 },
      { date: "2026-01-04", product: "Salt", quantity: 2, unit_price: -50 },
      null,
      { date: "2026-01-05", product: "Valid Product", quantity: 3, unit_price: 500, status: "completed" },
    ];

    const result = validateSalesRecords(malformed);
    assert.equal(result.isValid, true);
    assert.equal(result.validRecordsCount, 1);
    assert.equal(result.invalidRecordsCount, 6);
    assert.equal(result.validSales[0].product, "Valid Product");
    assert.equal(result.validSales[0].lineRevenue, 1500);
  });

  it("handles empty datasets without crashing", () => {
    const emptyResult = validateSalesRecords([]);
    assert.equal(emptyResult.isValid, false);
    assert.equal(emptyResult.validRecordsCount, 0);

    const emptyMetrics = calculateSummaryMetrics([]);
    assert.equal(emptyMetrics.totalRevenue, 0);
    assert.equal(emptyMetrics.completedOrdersCount, 0);

    const emptyComparison = compareSalesPeriods([]);
    assert.equal(emptyComparison.canCompare, false);
    assert.equal(emptyComparison.insufficientHistoricalData, true);
  });

  it("detects insufficient historical data when only 1 month exists", () => {
    const singleMonthSales = [
      { date: "2026-01-05", product: "Rice", quantity: 10, unit_price: 5000, status: "completed" },
      { date: "2026-01-20", product: "Rice", quantity: 5, unit_price: 5000, status: "completed" },
    ];

    const comparison = compareSalesPeriods(singleMonthSales);
    assert.equal(comparison.canCompare, false);
    assert.equal(comparison.insufficientHistoricalData, true);
    assert.match(comparison.reason, /at least 2 full periods are required/i);
  });

  it("accurately compares monthly periods and identifies revenue decline", () => {
    const sales = [
      // January 2026: ₦100,000
      { date: "2026-01-10", product: "Rice", quantity: 20, unit_price: 5000, status: "completed" },
      // February 2026: ₦60,000 (Drop of ₦40,000 = -40%)
      { date: "2026-02-10", product: "Rice", quantity: 12, unit_price: 5000, status: "completed" },
    ];

    const comparison = compareSalesPeriods(sales, {
      previousPeriod: "2026-01",
      currentPeriod: "2026-02",
    });

    assert.equal(comparison.canCompare, true);
    assert.equal(comparison.changes.revenue.previous, 100000);
    assert.equal(comparison.changes.revenue.current, 60000);
    assert.equal(comparison.changes.revenue.delta, -40000);
    assert.equal(comparison.changes.revenue.percentChange, -40);
    assert.equal(comparison.changes.revenue.direction, "decrease");
  });

  it("accurately attributes revenue decline to specific product contribution", () => {
    const janSales = [
      { date: "2026-01-05", product: "Rice", quantity: 30, unit_price: 3000, status: "completed" }, // 90,000
      { date: "2026-01-10", product: "Oil", quantity: 10, unit_price: 2000, status: "completed" },  // 20,000
    ]; // Total Jan = 110,000

    const febSales = [
      { date: "2026-02-05", product: "Rice", quantity: 10, unit_price: 3000, status: "completed" }, // 30,000 (drop: -60,000)
      { date: "2026-02-10", product: "Oil", quantity: 15, unit_price: 2000, status: "completed" },  // 30,000 (gain: +10,000)
    ]; // Total Feb = 60,000 (Net drop: -50,000)

    const productChange = analyzeProductPeriodChange(janSales, febSales);
    assert.equal(productChange.totalRevenueDelta, -50000);
    assert.equal(productChange.primaryDriverOfDecline.product, "Rice");
    assert.equal(productChange.primaryDriverOfDecline.revenueDelta, -60000);
    // Rice contributed (60000 / 50000) * 100 = 120% of net drop
    assert.equal(productChange.primaryDriverOfDecline.contributionPercent, -120);
    assert.equal(productChange.primaryDriverOfGrowth.product, "Oil");
    assert.equal(productChange.primaryDriverOfGrowth.revenueDelta, 10000);
  });

  it("verifies findings and flags speculative claims as hypotheses", () => {
    const comparison = {
      canCompare: true,
      previousPeriod: { period: "2026-01", metrics: { totalRevenue: 100000, completedOrdersCount: 10 } },
      currentPeriod: { period: "2026-02", metrics: { totalRevenue: 60000, completedOrdersCount: 6 } },
      changes: {
        revenue: { previous: 100000, current: 60000, delta: -40000, percentChange: -40 },
        orders: { delta: -4, percentChange: -40 },
        units: { delta: -10, percentChange: -25 },
      },
    };

    const productChanges = {
      primaryDriverOfDecline: {
        product: "Rice",
        revenueDelta: -40000,
        contributionPercent: -100,
        quantityDelta: -10,
      },
    };

    const candidateFindings = [
      { claim: "Competitor lowered prices so our sales crashed" }, // Speculative cause!
    ];

    const result = verifyAgentFindings({
      rawComparison: comparison,
      productChanges,
      findingsList: candidateFindings,
    });

    assert.equal(result.verifiedFindings.length >= 2, true);
    assert.equal(result.verifiedFindings[0].type, "VERIFIED_FACT");
    assert.equal(result.hypotheses.length, 1);
    assert.equal(result.hypotheses[0].type, "ACTIONABLE_HYPOTHESIS");
    assert.ok(result.dataLimitations.length >= 2);
  });

  it("parses and validates the synthetic CSV dataset successfully", () => {
    const csvPath = path.join(__dirname, "../data/sample-sales.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");

    const { records, parseErrors } = parseSalesCsvText(csvContent);
    assert.equal(parseErrors.length, 0);
    assert.ok(records.length >= 35);

    const { validSales, duplicateCount } = validateSalesRecords(records);
    assert.ok(validSales.length >= 35);

    const monthlyGroups = groupSalesByMonth(validSales);
    const months = Object.keys(monthlyGroups).sort();
    assert.deepEqual(months, ["2025-11", "2025-12", "2026-01", "2026-02"]);

    // Prove the deliberate revenue decline between Jan 2026 and Feb 2026
    const comparison = compareSalesPeriods(validSales, {
      previousPeriod: "2026-01",
      currentPeriod: "2026-02",
    });

    assert.equal(comparison.changes.revenue.direction, "decrease");
    assert.ok(comparison.changes.revenue.delta < 0);

    const janSales = validSales.filter((s) => s.date.startsWith("2026-01"));
    const febSales = validSales.filter((s) => s.date.startsWith("2026-02"));
    const productDiff = analyzeProductPeriodChange(janSales, febSales);

    // Parboiled Rice 25kg must be the primary driver of the decline
    assert.equal(productDiff.primaryDriverOfDecline.product, "Parboiled Rice 25kg");
    assert.ok(productDiff.primaryDriverOfDecline.revenueDelta < -1000000);
  });

  it("orchestrates a full investigation workflow with timeline and verified output", async () => {
    const csvPath = path.join(__dirname, "../data/sample-sales.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const { records } = parseSalesCsvText(csvContent);

    const result = await runSalesInvestigation({
      records,
      objective: "Why did revenue drop in February 2026?",
    });

    assert.equal(result.status, "completed");
    assert.ok(result.runId.startsWith("run_"));
    assert.ok(result.plan.length >= 5);
    assert.ok(result.timeline.length >= 6);
    assert.ok(result.findings.length >= 2);
    assert.ok(result.hypotheses.length >= 1);
    assert.ok(result.recommendations.length >= 2);
    assert.ok(result.dataLimitations.length >= 2);

    // Verify timeline has steps with success status
    const stepNames = result.timeline.map((t) => t.stepName);
    assert.ok(stepNames.includes("Data Validation"));
    assert.ok(stepNames.includes("Metric Calculation"));
    assert.ok(stepNames.includes("Period Comparison"));
    assert.ok(stepNames.includes("Product Contribution Analysis"));
    assert.ok(stepNames.includes("Evidence Verification"));
  });

  it("recovers gracefully when model fails or throws, providing verified fallback", async () => {
    const csvPath = path.join(__dirname, "../data/sample-sales.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const { records } = parseSalesCsvText(csvContent);

    // Simulated failing AI client
    const failingAiClient = {
      models: {
        generateContent: async () => {
          throw new Error("Simulated 503 Service Unavailable / Rate Limit");
        },
      },
    };

    const result = await runSalesInvestigation({
      records,
      objective: "Analyze revenue changes",
      aiClient: failingAiClient,
    });

    // Workflow must still succeed and deliver full verified findings through fallback!
    assert.equal(result.status, "completed");
    assert.ok(result.findings.length > 0);
    assert.ok(result.recommendations.length > 0);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /Simulated 503 Service Unavailable/);
  });

  it("fails gracefully without crashing when given completely unparseable data", async () => {
    const result = await runSalesInvestigation({
      records: [{ invalidField: 123 }, { anotherInvalid: "bad" }],
      objective: "Investigate empty data",
    });

    assert.equal(result.status, "failed");
    assert.equal(result.findings.length, 0);
    assert.ok(result.timeline.some((t) => t.status === "error"));
  });

  it("successfully parses real-world CSVs with UTF-8 BOM, aliases, and currency symbols", () => {
    // Simulating Excel export: UTF-8 BOM, alternate headers 'Order Date, Item, Qty, Price (NGN)' and currency '₦38,000'
    const realWorldCsv =
      "\uFEFFOrder Date,Item,Qty,Price,State\n" +
      "2026-01-05,Parboiled Rice 25kg,10,\"₦38,000\",completed\n" +
      "2026-01-08,Pure Vegetable Oil,5,\"14,500\",completed\n";

    const { records, parseErrors } = parseSalesCsvText(realWorldCsv);
    assert.equal(parseErrors.length, 0);
    assert.equal(records.length, 2);

    const { validSales, invalidRows } = validateSalesRecords(records);
    assert.equal(invalidRows.length, 0);
    assert.equal(validSales.length, 2);
    assert.equal(validSales[0].product, "Parboiled Rice 25kg");
    assert.equal(validSales[0].unit_price, 38000);
    assert.equal(validSales[0].lineRevenue, 380000);
    assert.equal(validSales[1].unit_price, 14500);
    assert.equal(validSales[1].lineRevenue, 72500);
  });
});


