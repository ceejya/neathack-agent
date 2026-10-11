
import express from "express";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { init, wrapGoogleGenAI } from "neatlogs";
import { createSalesRouter } from "./src/routes/sales.routes.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

let ai;

async function startServer() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in .env");
  }

  if (!process.env.NEATLOGS_API_KEY) {
    throw new Error("Missing NEATLOGS_API_KEY in .env");
  }

  await init({
    apiKey: process.env.NEATLOGS_API_KEY,
    workflowName: "neathack-research-agent",
  });

  const gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  ai = wrapGoogleGenAI(gemini);

  // Mount SalesPulse AI API routes
  app.use("/api/sales", createSalesRouter(() => ai));

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      message: "SalesPulse AI & NeatHack Agent is running!",
      version: "1.0.0",
    });
  });

  app.post("/research", async (req, res) => {
    try {
      const { question } = req.body;

      if (typeof question !== "string" || !question.trim()) {
        return res.status(400).json({
          error: "Please provide a research question.",
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `You are a research and verification assistant.

Answer the user's question clearly.
Separate established facts from uncertainty.
Never invent sources, URLs, or citations.
If you cannot verify a claim from the information available,
say so clearly.

User's question: ${question}`,
      });

      res.json({
        question,
        answer: response.text,
        note: "Verify important claims against reliable sources.",
      });
    } catch (error) {
          console.error("Research error:", error);

      res.status(500).json({
        error: "The research request failed. Check the server logs.",
      });
    }
  });

  

  const server = app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(` SalesPulse AI Server Running!`);
    console.log(` Web UI: http://localhost:${PORT}`);
    console.log(` Health: http://localhost:${PORT}/api/health`);
    console.log(`========================================\n`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
      console.error(`To stop the old process and free port ${PORT}, run:`);
      console.error(`   kill -9 $(lsof -t -i:${PORT})\n`);
      console.error(`Or start on another port:`);
      console.error(`   PORT=3001 npm start\n`);
    } else {
      console.error("Server error:", err);
    }
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});
