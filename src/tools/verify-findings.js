/**
 * SalesPulse AI - Findings Verification Tool
 * Compares agent claims against deterministic mathematical ground truth.
 * Separates verified facts from hypotheses and documents data limitations.
 */

export function verifyAgentFindings({
  rawComparison,
  productChanges,
  findingsList = [],
}) {
  const verifiedFindings = [];
  const hypotheses = [];
  const dataLimitations = [];
  const verificationIssues = [];

  // Ground truth extraction
  const groundTruth = {
    hasComparison: Boolean(rawComparison?.canCompare),
    prevRevenue: rawComparison?.changes?.revenue?.previous ?? 0,
    currRevenue: rawComparison?.changes?.revenue?.current ?? 0,
    revenueDelta: rawComparison?.changes?.revenue?.delta ?? 0,
    revenuePercentChange: rawComparison?.changes?.revenue?.percentChange ?? 0,
    ordersDelta: rawComparison?.changes?.orders?.delta ?? 0,
    unitsDelta: rawComparison?.changes?.units?.delta ?? 0,
    primaryDeclineProduct: productChanges?.primaryDriverOfDecline?.product ?? null,
    primaryDeclineAmount: productChanges?.primaryDriverOfDecline?.revenueDelta ?? 0,
    primaryDeclineContrib: productChanges?.primaryDriverOfDecline?.contributionPercent ?? 0,
  };

  // 1. Mandatory Data Limitations
  dataLimitations.push({
    category: "Cost & Profitability",
    message: "Cost of Goods Sold (COGS) is not tracked in this dataset. All figures represent gross revenue; profit and margins cannot be confirmed.",
  });
  dataLimitations.push({
    category: "External Factors",
    message: "The dataset contains sales transaction records only. Marketing spend, Instagram algorithm shifts, competitor actions, and stockouts cannot be verified without external data.",
  });

  // 2. Build Core Mathematical Facts directly from Ground Truth
  if (groundTruth.hasComparison) {
    const isDecline = groundTruth.revenueDelta < 0;
    const directionWord = isDecline ? "fell" : groundTruth.revenueDelta > 0 ? "increased" : "remained flat";

    verifiedFindings.push({
      type: "VERIFIED_FACT",
      metric: "Total Revenue",
      claim: `Monthly revenue ${directionWord} by ₦${Math.abs(groundTruth.revenueDelta).toLocaleString()} (${Math.abs(groundTruth.revenuePercentChange)}%) from ${rawComparison.previousPeriod.period} to ${rawComparison.currentPeriod.period}.`,
      evidence: {
        previousPeriod: rawComparison.previousPeriod.period,
        previousRevenue: groundTruth.prevRevenue,
        currentPeriod: rawComparison.currentPeriod.period,
        currentRevenue: groundTruth.currRevenue,
        delta: groundTruth.revenueDelta,
        percentChange: groundTruth.revenuePercentChange,
      },
      verified: true,
    });

    verifiedFindings.push({
      type: "VERIFIED_FACT",
      metric: "Order & Unit Volume",
      claim: `Completed orders changed by ${groundTruth.ordersDelta > 0 ? "+" : ""}${groundTruth.ordersDelta} (${rawComparison.changes.orders.percentChange}%) and total units sold changed by ${groundTruth.unitsDelta > 0 ? "+" : ""}${groundTruth.unitsDelta} (${rawComparison.changes.units.percentChange}%).`,
      evidence: {
        ordersChange: rawComparison.changes.orders,
        unitsChange: rawComparison.changes.units,
      },
      verified: true,
    });

    if (groundTruth.primaryDeclineProduct) {
      verifiedFindings.push({
        type: "VERIFIED_FACT",
        metric: "Primary Driver of Decline",
        claim: `${groundTruth.primaryDeclineProduct} was the single largest negative contributor, dropping by ₦${Math.abs(groundTruth.primaryDeclineAmount).toLocaleString()} (accounting for approximately ${Math.abs(groundTruth.primaryDeclineContrib)}% of the total revenue drop).`,
        evidence: {
          product: groundTruth.primaryDeclineProduct,
          revenueDrop: groundTruth.primaryDeclineAmount,
          contributionPercentage: groundTruth.primaryDeclineContrib,
          quantityDrop: productChanges.primaryDriverOfDecline.quantityDelta,
        },
        verified: true,
      });
    }
  }

  // 3. Audit candidate findings submitted by LLM or workflow
  if (Array.isArray(findingsList)) {
    findingsList.forEach((item) => {
      if (!item || typeof item !== "object") return;

      if (item.type === "HYPOTHESIS" || item.type === "ACTIONABLE_HYPOTHESIS" || item.isHypothesis || (item.title && item.description)) {
        hypotheses.push({
          type: "ACTIONABLE_HYPOTHESIS",
          title: item.title || "Potential Factor to Investigate",
          description: item.description || item.claim || String(item),
          suggestedAction: item.suggestedAction || "Verify with supplier or customer feedback.",
        });
      } else if (item.claim) {
        // Check for unwarranted certainty on unobserved causes
        const unverifiedKeywords = ["marketing stopped", "ad spend", "competitor lowered prices", "customers hated", "out of stock"];
        const lowerClaim = item.claim.toLowerCase();
        const hasUnverifiedCause = unverifiedKeywords.some((kw) => lowerClaim.includes(kw));

        if (hasUnverifiedCause) {
          verificationIssues.push(`Downgraded claim to hypothesis: '${item.claim}' attributes causation not present in transaction data.`);
          hypotheses.push({
            type: "ACTIONABLE_HYPOTHESIS",
            title: "Unverified Operational Factor",
            description: item.claim,
            suggestedAction: "Check inventory logs or promotion records to confirm if this factor occurred.",
          });
        }
      }
    });
  }

  return {
    verified: verificationIssues.length === 0,
    groundTruth,
    verifiedFindings,
    hypotheses,
    dataLimitations,
    verificationIssues,
  };
}
