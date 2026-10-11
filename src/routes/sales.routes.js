/**
 * SalesPulse AI - Express API Routes
 */

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseSalesCsvText, validateSalesRecords } from "../tools/validate-sales.js";
import { calculateSummaryMetrics, groupSalesByMonth } from "../tools/calculate-metrics.js";
import { compareSalesPeriods } from "../tools/compare-periods.js";
import { analyzeProductPerformance } from "../tools/analyze-products.js";
import { runSalesInvestigation } from "../agent/orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createSalesRouter(getAiClient) {
  const router = express.Router();

  /**
   * GET /api/sales/sample
   * Returns synthetic dataset from data/sample-sales.csv for immediate 1-click testing
   */
  router.get("/sample", (req, res) => {
    try {
      const sampleCsvPath = path.join(__dirname, "../../data/sample-sales.csv");
      if (!fs.existsSync(sampleCsvPath)) {
        return res.status(404).json({ error: "Sample data file not found." });
      }

      const csvContent = fs.readFileSync(sampleCsvPath, "utf-8");
      const { records, parseErrors } = parseSalesCsvText(csvContent);

      if (parseErrors.length > 0) {
        return res.status(500).json({ error: "Error parsing sample data", details: parseErrors });
      }

      const { validSales } = validateSalesRecords(records);
      const metrics = calculateSummaryMetrics(validSales);

      res.json({
        success: true,
        recordCount: validSales.length,
        records: validSales,
        csvText: csvContent,
        quickMetrics: metrics,
      });
    } catch (err) {
      console.error("Error serving sample data:", err);
      res.status(500).json({ error: "Failed to read sample sales data." });
    }
  });

  /**
   * POST /api/sales/validate
   * Validates submitted sales records or CSV string without running full LLM agent
   */
  router.post("/validate", (req, res) => {
    try {
      const { records, csvText } = req.body;
      let rawRecords = records;

      if (typeof csvText === "string" && csvText.trim()) {
        if (csvText.length > 5 * 1024 * 1024) {
          return res.status(413).json({ error: "CSV payload exceeds 5MB size limit." });
        }
        const parsed = parseSalesCsvText(csvText);
        if (parsed.parseErrors.length > 0 && parsed.records.length === 0) {
          return res.status(400).json({ error: "CSV parsing failed.", parseErrors: parsed.parseErrors });
        }
        rawRecords = parsed.records;
      }

      if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
        return res.status(400).json({ error: "No sales records provided for validation." });
      }

      const validation = validateSalesRecords(rawRecords);
      const metrics = calculateSummaryMetrics(validation.validSales);
      const monthly = groupSalesByMonth(validation.validSales);
      const comparison = compareSalesPeriods(validation.validSales);
      const products = analyzeProductPerformance(validation.validSales);

      res.json({
        success: true,
        validation,
        metrics,
        monthly,
        comparison,
        products,
      });
    } catch (err) {
      console.error("Validation error:", err);
      res.status(500).json({ error: "Internal validation error." });
    }
  });

  /**
   * POST /api/sales/analyze
   * Runs the full bounded agent investigation loop
   */
  router.post("/analyze", async (req, res) => {
    try {
      const { records, csvText, objective } = req.body;
      let rawRecords = records;

      if (typeof csvText === "string" && csvText.trim()) {
        if (csvText.length > 5 * 1024 * 1024) {
          return res.status(413).json({ error: "CSV payload exceeds 5MB size limit." });
        }
        const parsed = parseSalesCsvText(csvText);
        if (parsed.parseErrors.length > 0 && parsed.records.length === 0) {
          return res.status(400).json({ error: "CSV parsing failed.", parseErrors: parsed.parseErrors });
        }
        rawRecords = parsed.records;
      }

      if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
        return res.status(400).json({
          error: "Please provide sales records or upload a valid CSV to investigate.",
        });
      }

      const aiClient = getAiClient ? getAiClient() : null;

      const investigationResult = await runSalesInvestigation({
        records: rawRecords,
        objective: objective || "Investigate changes in sales performance and produce an action plan.",
        aiClient,
        modelName: "gemini-3.8-flash",
      });

      res.json(investigationResult);
    } catch (err) {
      console.error("Investigation error:", err);
      res.status(500).json({
        error: "Investigation failed. Check server logs.",
        details: err.message,
      });
    }
  });

  return router;
}
