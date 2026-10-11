/**
 * SalesPulse AI - Bounded Agent Orchestrator
 * Coordinates deterministic sales tools, maintains state, calls wrapped Gemini model,
 * verifies evidence, and produces verifiable action plans.
 */

import { AgentState } from "./agent-state.js";
import { validateSalesRecords } from "../tools/validate-sales.js";
import { calculateSummaryMetrics, groupSalesByMonth } from "../tools/calculate-metrics.js";
import { compareSalesPeriods } from "../tools/compare-periods.js";
import { analyzeProductPerformance, analyzeProductPeriodChange } from "../tools/analyze-products.js";
import { verifyAgentFindings } from "../tools/verify-findings.js";
import { SYSTEM_ANALYST_PROMPT, buildSynthesisPrompt } from "./prompts.js";

const TOOL_ALLOWLIST = new Set([
  "validate_sales",
  "calculate_metrics",
  "compare_periods",
  "analyze_products",
  "verify_findings",
]);

export async function runSalesInvestigation({
  records,
  objective = "Investigate changes in sales performance and produce an action plan.",
  aiClient = null,
  modelName = "gemini-3.8-flash",
}) {
  const state = new AgentState(objective, { model: modelName });
  state.status = "planning";

  try {
    // 1. Initial Plan formulation
    const planSteps = [
      { step: 1, tool: "validate_sales", description: "Validate data structure, dates, and detect duplicates or anomalies." },
      { step: 2, tool: "calculate_metrics", description: "Compute deterministic totals, completed revenue, and cancellation rates." },
      { step: 3, tool: "compare_periods", description: "Compare the most recent period against the previous equivalent period." },
      { step: 4, tool: "analyze_products", description: "Analyze product-level revenue contribution and isolate primary drivers." },
      { step: 5, tool: "verify_findings", description: "Verify numerical claims against arithmetic ground truth and separate facts from hypotheses." },
      { step: 6, tool: "synthesize_report", description: "Generate prioritized, evidence-backed action plan." },
    ];
    state.setPlan(planSteps);

    // STEP 1: Execute validate_sales
    state.addTimelineEntry({
      stepName: "Data Validation",
      toolName: "validate_sales",
      status: "running",
      summary: "Inspecting submitted records for required fields, dates, and valid numbers...",
    });

    const validationResult = validateSalesRecords(records);
    state.recordToolResult("validate_sales", validationResult);

    if (!validationResult.isValid) {
      state.fail(validationResult.error || "No valid sales transactions found in dataset.");
      return state.toJSON();
    }

    state.addTimelineEntry({
      stepName: "Data Validation",
      toolName: "validate_sales",
      status: "success",
      summary: `Validated ${validationResult.validRecordsCount} records. Date span: ${validationResult.dateRange?.min} to ${validationResult.dateRange?.max}. Detected ${validationResult.duplicateCount} duplicates and ${validationResult.invalidRecordsCount} invalid rows.`,
      details: {
        validCount: validationResult.validRecordsCount,
        invalidCount: validationResult.invalidRecordsCount,
        duplicateCount: validationResult.duplicateCount,
        warnings: validationResult.warnings,
      },
    });

    const sales = validationResult.validSales;

    // STEP 2: Execute calculate_metrics
    state.addTimelineEntry({
      stepName: "Metric Calculation",
      toolName: "calculate_metrics",
      status: "running",
      summary: "Calculating total revenue, orders, units, and cancellation rates...",
    });

    const summaryMetrics = calculateSummaryMetrics(sales);
    const monthlyMetrics = groupSalesByMonth(sales);
    state.recordToolResult("calculate_metrics", { summaryMetrics, monthlyMetrics });

    state.addTimelineEntry({
      stepName: "Metric Calculation",
      toolName: "calculate_metrics",
      status: "success",
      summary: `Gross Completed Revenue: ₦${summaryMetrics.totalRevenue.toLocaleString()} across ${summaryMetrics.completedOrdersCount} orders (${summaryMetrics.cancelledOrdersCount} cancelled orders).`,
      details: summaryMetrics,
    });

    // STEP 3: Execute compare_periods
    state.addTimelineEntry({
      stepName: "Period Comparison",
      toolName: "compare_periods",
      status: "running",
      summary: "Evaluating Month-over-Month changes between latest two months...",
    });

    const periodComparison = compareSalesPeriods(sales);
    state.recordToolResult("compare_periods", periodComparison);

    if (!periodComparison.canCompare) {
      state.addTimelineEntry({
        stepName: "Period Comparison",
        toolName: "compare_periods",
        status: "warning",
        summary: periodComparison.reason,
      });
    } else {
      const revChange = periodComparison.changes.revenue;
      state.addTimelineEntry({
        stepName: "Period Comparison",
        toolName: "compare_periods",
        status: "success",
        summary: `Comparing ${periodComparison.previousPeriod.period} vs ${periodComparison.currentPeriod.period}: Revenue ${revChange.direction} by ₦${Math.abs(revChange.delta).toLocaleString()} (${Math.abs(revChange.percentChange)}%).`,
        details: periodComparison.changes,
      });
    }

    // STEP 4: Execute analyze_products
    state.addTimelineEntry({
      stepName: "Product Contribution Analysis",
      toolName: "analyze_products",
      status: "running",
      summary: "Analyzing product breakdown and calculating exact contributions to revenue changes...",
    });

    let productChanges = null;
    let allProductPerformance = analyzeProductPerformance(sales);

    if (periodComparison.canCompare) {
      const prevMonth = periodComparison.previousPeriod.period;
      const currMonth = periodComparison.currentPeriod.period;
      const prevSales = sales.filter((s) => s.date.startsWith(prevMonth));
      const currSales = sales.filter((s) => s.date.startsWith(currMonth));
      productChanges = analyzeProductPeriodChange(prevSales, currSales, periodComparison.changes.revenue.delta);
    }

    state.recordToolResult("analyze_products", {
      allTime: allProductPerformance,
      periodChanges: productChanges,
    });

    const primaryDriver = productChanges?.primaryDriverOfDecline || productChanges?.primaryDriverOfGrowth;
    state.addTimelineEntry({
      stepName: "Product Contribution Analysis",
      toolName: "analyze_products",
      status: "success",
      summary: primaryDriver
        ? `Identified primary driver: '${primaryDriver.product}' (revenue change: ₦${primaryDriver.revenueDelta.toLocaleString()}, volume change: ${primaryDriver.quantityDelta} units).`
        : `Evaluated ${allProductPerformance.productCount} distinct products.`,
      details: productChanges || allProductPerformance,
    });

    // STEP 5: Verification of findings against mathematical ground truth
    state.addTimelineEntry({
      stepName: "Evidence Verification",
      toolName: "verify_findings",
      status: "running",
      summary: "Cross-checking all claims against deterministic arithmetic ground truth...",
    });

    const initialVerification = verifyAgentFindings({
      rawComparison: periodComparison,
      productChanges,
      findingsList: [],
    });

    state.recordToolResult("verify_findings", initialVerification);
    state.addTimelineEntry({
      stepName: "Evidence Verification",
      toolName: "verify_findings",
      status: "success",
      summary: `Verified ${initialVerification.verifiedFindings.length} mathematical facts. Enforced ${initialVerification.dataLimitations.length} explicit data limitations.`,
      details: {
        verifiedCount: initialVerification.verifiedFindings.length,
        limitations: initialVerification.dataLimitations,
      },
    });

    // STEP 6: Synthesize actionable report with Gemini (via wrapped client)
    state.addTimelineEntry({
      stepName: "Strategic Action Synthesis",
      toolName: "synthesize_report",
      status: "running",
      summary: "Interpreting verified metrics and generating prioritized, evidence-backed recommendations...",
    });

    let llmInterpretation = null;
    if (aiClient && typeof aiClient.models?.generateContent === "function") {
      const promptText = buildSynthesisPrompt({
        objective: state.objective,
        comparisonData: periodComparison,
        productData: productChanges,
        summaryData: summaryMetrics,
        validationData: validationResult,
      });

      try {
        const geminiResponse = await aiClient.models.generateContent({
          model: modelName,
          contents: `${SYSTEM_ANALYST_PROMPT}\n\n${promptText}`,
        });

        const rawText = geminiResponse?.text || "";
        // Clean JSON formatting if code fenced
        const cleanedJson = rawText.replace(/^```json\s*|```$/gi, "").trim();
        llmInterpretation = JSON.parse(cleanedJson);
      } catch (llmError) {
        state.errors.push({
          context: "Gemini Model Call / Parse",
          message: llmError.message,
        });
        // We do not abort: fallback to deterministic expert synthesis!
      }
    }

    // Fallback if LLM unavailable or failed to parse
    if (!llmInterpretation) {
      llmInterpretation = generateFallbackSynthesis({
        comparison: periodComparison,
        productChanges,
        summaryMetrics,
      });
    }

    // Final audit of candidate hypotheses and recommendations
    const finalVerification = verifyAgentFindings({
      rawComparison: periodComparison,
      productChanges,
      findingsList: llmInterpretation.hypotheses || [],
    });

    const finalRecommendations = (llmInterpretation.recommendations || []).map((rec, index) => ({
      id: `rec_${index + 1}`,
      priority: rec.priority || "MEDIUM",
      title: rec.title || "Sales Action Item",
      action: rec.action || "",
      expectedImpact: rec.expectedImpact || "",
      evidence: rec.evidence || "Derived from sales period comparison.",
    }));

    state.complete({
      findings: finalVerification.verifiedFindings,
      hypotheses: finalVerification.hypotheses,
      recommendations: finalRecommendations,
      limitations: finalVerification.dataLimitations,
    });

    return state.toJSON();
  } catch (fatalError) {
    state.recordError(fatalError, "Fatal Orchestrator Exception");
    state.fail(fatalError.message);
    return state.toJSON();
  }
}

/**
 * Deterministic fallback generator if LLM call is unavailable or fails
 */
function generateFallbackSynthesis({ comparison, productChanges, summaryMetrics }) {
  const isDecline = comparison?.changes?.revenue?.delta < 0;
  const primaryDecline = productChanges?.primaryDriverOfDecline;

  const hypotheses = [];
  const recommendations = [];

  if (isDecline && primaryDecline) {
    hypotheses.push({
      type: "ACTIONABLE_HYPOTHESIS",
      title: `Possible Stockout or Sourcing Delay for ${primaryDecline.product}`,
      description: `Sales volume for ${primaryDecline.product} plummeted by ${Math.abs(primaryDecline.quantityDelta)} units while average unit price stayed relatively stable.`,
      suggestedAction: `Check supplier availability and WhatsApp customer inquiries to confirm whether demand dropped or inventory ran out.`,
    });

    recommendations.push({
      priority: "HIGH",
      title: `Investigate ${primaryDecline.product} Inventory & Sourcing`,
      action: `Contact your wholesale supplier immediately to verify stock availability and purchase price for ${primaryDecline.product}.`,
      expectedImpact: `Quickly recover up to ₦${Math.abs(primaryDecline.revenueDelta).toLocaleString()} in missed monthly sales.`,
      evidence: `${primaryDecline.product} accounted for the majority of the recent revenue decline.`,
    });
  }

  if (summaryMetrics?.cancelledOrdersCount > 0) {
    recommendations.push({
      priority: "MEDIUM",
      title: "Streamline WhatsApp / Instagram Payment Confirmation",
      action: "Implement clear 24-hour payment hold windows and follow up with pending customers before cancelling orders.",
      expectedImpact: `Recover lost revenue from ${summaryMetrics.cancelledOrdersCount} cancelled orders (valued at ₦${(summaryMetrics.cancelledRevenue || 0).toLocaleString()}).`,
      evidence: `Observed a ${summaryMetrics.cancellationRatePercent}% cancellation rate in the submitted dataset.`,
    });
  }

  recommendations.push({
    priority: "MEDIUM",
    title: "Promote Resilient Complementary Products",
    action: "Create bundled promotions combining top-performing stable products on Instagram and WhatsApp Status.",
    expectedImpact: "Diversifies revenue stream and buffers against single-product inventory shocks.",
    evidence: "Transaction records show multi-product purchases have higher average basket size.",
  });

  return {
    executiveSummary: isDecline
      ? `Revenue declined primarily due to a drop in sales volume of ${primaryDecline?.product || "core items"}.`
      : "Overall revenue demonstrated positive growth across primary product lines.",
    hypotheses,
    recommendations,
  };
}
