
import express from "express";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { init, wrapGoogleGenAI } from "neatlogs";

const app = express();
app.use(express.json());

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

  app.get("/", (req, res) => {
    res.json({
      message: "NeatHack Research Agent is running!",
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

  

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`); 
  });
}

startServer().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});
