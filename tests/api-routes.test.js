import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createSalesRouter } from "../src/routes/sales.routes.js";

describe("SalesPulse AI - API Routes & Integration Tests", () => {
  const mockAiClient = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify({
          executiveSummary: "Revenue fell primarily due to a 60% drop in Parboiled Rice volume.",
          hypotheses: [
            {
              title: "Potential Rice Stockout",
              description: "Wholesale supplier delays may have depleted inventory in February.",
              suggestedAction: "Check WhatsApp order messages and delivery receipts.",
            },
          ],
          recommendations: [
            {
              priority: "HIGH",
              title: "Restock Core Rice Inventory",
              action: "Contact supplier for priority delivery to recover missed revenue.",
              expectedImpact: "Recover up to ₦1,200,000 in monthly sales.",
              evidence: "Rice volume fell by 30 units between Jan and Feb.",
            },
          ],
        }),
      }),
    },
  };

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api/sales", createSalesRouter(() => mockAiClient));

  // Helper to simulate express requests
  function makeRequest(handler, req) {
    return new Promise((resolve) => {
      const res = {
        statusCode: 200,
        headers: {},
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          resolve({ status: this.statusCode, data });
        },
      };
      handler(req, res);
    });
  }

  it("serves sample dataset via GET /api/sales/sample", async () => {
    const router = createSalesRouter(() => mockAiClient);
    // Find GET /sample handler
    const sampleRoute = router.stack.find(
      (layer) => layer.route && layer.route.path === "/sample" && layer.route.methods.get
    );
    assert.ok(sampleRoute, "GET /sample route exists");

    const response = await makeRequest(sampleRoute.route.stack[0].handle, {
      method: "GET",
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.success, true);
    assert.ok(response.data.recordCount >= 35);
    assert.ok(response.data.quickMetrics.totalRevenue > 0);
  });

  it("validates sales records via POST /api/sales/validate", async () => {
    const router = createSalesRouter(() => mockAiClient);
    const validateRoute = router.stack.find(
      (layer) => layer.route && layer.route.path === "/validate" && layer.route.methods.post
    );

    const validPayload = {
      records: [
        { date: "2026-01-01", product: "Rice", quantity: 5, unit_price: 3000, status: "completed" },
        { date: "2026-01-02", product: "Oil", quantity: 2, unit_price: 1500, status: "completed" },
      ],
    };

    const response = await makeRequest(validateRoute.route.stack[0].handle, {
      method: "POST",
      body: validPayload,
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.success, true);
    assert.equal(response.data.validation.validRecordsCount, 2);
    assert.equal(response.data.metrics.totalRevenue, 18000);
  });

  it("rejects malformed CSV strings with clear error feedback", async () => {
    const router = createSalesRouter(() => mockAiClient);
    const validateRoute = router.stack.find(
      (layer) => layer.route && layer.route.path === "/validate" && layer.route.methods.post
    );

    const badCsvPayload = {
      csvText: "wrong_header_one,wrong_header_two\n1,2",
    };

    const response = await makeRequest(validateRoute.route.stack[0].handle, {
      method: "POST",
      body: badCsvPayload,
    });

    assert.equal(response.status, 400);
    assert.match(response.data.error, /CSV parsing failed/i);
    assert.ok(response.data.parseErrors.length > 0);
  });

  it("executes full investigation through POST /api/sales/analyze with real client synthesis", async () => {
    const router = createSalesRouter(() => mockAiClient);
    const analyzeRoute = router.stack.find(
      (layer) => layer.route && layer.route.path === "/analyze" && layer.route.methods.post
    );

    const payload = {
      objective: "Why did revenue fall last month?",
      records: [
        { date: "2026-01-05", product: "Rice", quantity: 20, unit_price: 3000, status: "completed" },
        { date: "2026-02-05", product: "Rice", quantity: 8, unit_price: 3000, status: "completed" },
      ],
    };

    const response = await makeRequest(analyzeRoute.route.stack[0].handle, {
      method: "POST",
      body: payload,
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.status, "completed");
    assert.ok(response.data.timeline.length >= 5);
    assert.ok(response.data.findings.length >= 1);
    assert.ok(response.data.recommendations.length >= 1);
  });
});
