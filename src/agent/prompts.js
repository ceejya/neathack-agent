/**
 * SalesPulse AI - Agent Prompts and Guardrails
 */

export const SYSTEM_ANALYST_PROMPT = `You are SalesPulse AI, an expert, evidence-backed business analyst for small online merchants (selling on Instagram, WhatsApp, and social commerce in Nigeria).

CRITICAL OPERATIONAL RULES:
1. MATHEMATICAL TRUTH: All metrics, revenues, and percentage changes provided in the context have been deterministically calculated in JavaScript. Never invent, alter, or recompute new numerical totals.
2. DISTINGUISH FACTS FROM HYPOTHESES:
   - A VERIFIED FACT is an exact numerical trend present in the transaction data (e.g., "Revenue dropped by ₦1,240,000 (-45%) in February due to an 80% volume drop in Parboiled Rice").
   - An ACTIONABLE HYPOTHESIS is an unobserved operational factor (e.g., "The drop in rice volume may have been caused by a supplier stockout, increased procurement costs, or reduced social media posts").
   - NEVER state an unobserved factor as an undisputed fact.
3. PROFIT DISCLAIMER: The merchant data has no Cost of Goods Sold (COGS). State clearly that profitability and margins cannot be confirmed.
4. ACTIONABLE ADVICE: Provide realistic, high-priority actions for a social commerce merchant (e.g., WhatsApp broadcast follow-ups, supplier price negotiation, restocking popular bundle sizes).
5. TONE: Clear, encouraging, professional, and easily understood by non-technical business owners without confusing jargon.`;

export function buildSynthesisPrompt({
  objective,
  comparisonData,
  productData,
  summaryData,
  validationData,
}) {
  return `User Objective: "${objective}"

DETERMINISTIC ANALYSIS CONTEXT:
${JSON.stringify(
  {
    dateRange: validationData?.dateRange,
    totalRecords: validationData?.validRecordsCount,
    duplicatesDetected: validationData?.duplicateCount,
    monthlyComparison: comparisonData
      ? {
          previousPeriod: comparisonData.previousPeriod?.period,
          currentPeriod: comparisonData.currentPeriod?.period,
          revenueChange: comparisonData.changes?.revenue,
          ordersChange: comparisonData.changes?.orders,
          unitsChange: comparisonData.changes?.units,
          cancellationRateChange: comparisonData.changes?.cancellationRate,
        }
      : null,
    productDrivers: productData
      ? {
          primaryDeclineProduct: productData.primaryDriverOfDecline,
          primaryGrowthProduct: productData.primaryDriverOfGrowth,
          topDecliners: productData.decliners?.slice(0, 3),
          topGainers: productData.gainers?.slice(0, 3),
        }
      : null,
    overallSummary: summaryData
      ? {
          totalCompletedRevenue: summaryData.totalRevenue,
          cancelledRevenue: summaryData.cancelledRevenue,
          completedOrders: summaryData.completedOrdersCount,
          cancelledOrders: summaryData.cancelledOrdersCount,
          cancellationRatePercent: summaryData.cancellationRatePercent,
        }
      : null,
  },
  null,
  2
)}

TASK:
Based strictly on this data, provide an executive summary, identify top hypotheses for what the merchant should check operationally, and provide 3-4 prioritised recommendations.

RESPOND IN VALID JSON ONLY using the following schema:
{
  "executiveSummary": "Concise 2-3 sentence overview of what happened to sales and the main driver.",
  "hypotheses": [
    {
      "title": "Short title (e.g. Stockout or Inventory Gap)",
      "description": "Explanation of what might have occurred operationally without assuming certainty.",
      "suggestedAction": "Concrete check the merchant should do (e.g., Check supplier delivery logs for Rice in February)."
    }
  ],
  "recommendations": [
    {
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "title": "Action title",
      "action": "Clear, practical action for an Instagram/WhatsApp merchant",
      "expectedImpact": "Expected benefit or risk mitigation",
      "evidence": "Which exact data point supports this recommendation"
    }
  ]
}`;
}
