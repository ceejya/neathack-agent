/**
 * SalesPulse AI - CLI Agent Runner
 * Runs the full agent investigation directly from the command line.
 * Usage: node scripts/test-agent.js
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { init, wrapGoogleGenAI } from "neatlogs";

import { parseSalesCsvText } from "../src/tools/validate-sales.js";
import { runSalesInvestigation } from "../src/agent/orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("\n=========================================================");
  console.log("   SalesPulse AI — Autonomous Agent CLI Test");
  console.log("=========================================================\n");

  let ai = null;
  if (process.env.GEMINI_API_KEY && process.env.NEATLOGS_API_KEY) {
    console.log("1. Initializing Neatlogs & Gemini 3.8 Flash Client...");
    await init({
      apiKey: process.env.NEATLOGS_API_KEY,
      workflowName: "neathack-research-agent",
    });

    const gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    ai = wrapGoogleGenAI(gemini);
    console.log("   ✓ Client wrapped and traced with Neatlogs.\n");
  } else {
    console.log("   ⚠ Missing API keys in .env — using deterministic fallback synthesis.\n");
  }

  console.log("2. Loading dataset (data/sample-sales.csv)...");
  const csvPath = path.join(__dirname, "../data/sample-sales.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const { records, parseErrors } = parseSalesCsvText(csvContent);

  if (parseErrors.length > 0) {
    console.error("   ❌ CSV Parse Errors:", parseErrors);
    process.exit(1);
  }
  console.log(`   ✓ Loaded ${records.length} transactions.\n`);

  const objective = "Why did my revenue fall last month, and what should I do next?";
  console.log(`3. Running Autonomous Investigation...`);
  console.log(`   Objective: "${objective}"\n`);

  const startTime = Date.now();
  const result = await runSalesInvestigation({
    records,
    objective,
    aiClient: ai,
    modelName: "gemini-3.8-flash",
  });
  const elapsed = Date.now() - startTime;

  console.log("---------------------------------------------------------");
  console.log(`Investigation Completed in ${elapsed}ms (Run ID: ${result.runId})`);
  console.log("---------------------------------------------------------\n");

  console.log("📋 TIMELINE OF AGENT ACTIONS:");
  result.timeline.forEach((step, idx) => {
    const icon = step.status === "error" ? "❌" : step.status === "warning" ? "⚠️" : "✓";
    console.log(`  [Step ${idx + 1}] ${icon} ${step.stepName} (${step.toolName || "core"}): ${step.summary}`);
  });

  console.log("\n🔍 VERIFIED FACTS (Mathematical Truth):");
  result.findings.forEach((fact, idx) => {
    console.log(`  ${idx + 1}. [${fact.metric}] ${fact.claim}`);
  });

  console.log("\n💡 ACTIONABLE HYPOTHESES (Operational checks for merchant):");
  result.hypotheses.forEach((hyp, idx) => {
    console.log(`  ${idx + 1}. ${hyp.title}`);
    console.log(`     Details: ${hyp.description}`);
    console.log(`     Action : ${hyp.suggestedAction}`);
  });

  console.log("\n🎯 PRIORITIZED RECOMMENDATIONS:");
  result.recommendations.forEach((rec, idx) => {
    console.log(`  ${idx + 1}. [${rec.priority} PRIORITY] ${rec.title}`);
    console.log(`     Action: ${rec.action}`);
    if (rec.expectedImpact) console.log(`     Impact: ${rec.expectedImpact}`);
    console.log(`     Evidence: ${rec.evidence}`);
  });

  console.log("\n⚠️ DATA BOUNDARIES & ACCOUNTING DISCLAIMER:");
  result.dataLimitations.forEach((lim) => {
    console.log(`  • ${lim.category}: ${lim.message}`);
  });

  console.log("\n=========================================================");
  console.log("   Investigation Completed Successfully!");
  console.log("=========================================================\n");
}

main().catch((err) => {
  console.error("CLI test execution error:", err);
  process.exit(1);
});
