# SalesPulse AI — Architecture Documentation

**Tagline:** Understand your sales. Investigate the changes. Decide what to do next.  
**Hackathon:** neatHack

---

## 1. System Overview

SalesPulse AI is an AI-powered business analyst tailored for small social commerce merchants (selling via Instagram, WhatsApp, TikTok, and local storefronts in Nigeria). It bridges the gap between raw, scattered transaction records and strategic business decisions without requiring spreadsheet formulas or data science knowledge.

```
┌────────────────────────────────────────────────────────┐
│                   Browser Client (SaaS UI)             │
│  - Vanilla HTML5 / CSS3 (Sleek SaaS aesthetic)         │
│  - LocalStorage Demo Persistence (No DB, 100% Privacy) │
│  - 1-Click Sample Data / Manual Entry / Optional CSV   │
└────────────┬────────────────────────────▲──────────────┘
             │ HTTP POST                  │ JSON Report & Timeline
             ▼                            │
┌────────────────────────────────────────────────────────┐
│               Express 5 Backend Entrypoint             │
│  - index.js (Static hosting + API routing)             │
│  - Preserved /research & /api/sales routes             │
└────────────┬────────────────────────────▲──────────────┘
             │                            │
             ▼                            │
┌────────────────────────────────────────────────────────┐
│              Bounded Agent Orchestrator                │
│  - AgentState (Run ID, Plan, Timeline, Audit Log)      │
│  - Explicit Tool Allowlist (Max 6 Bounded Iterations)  │
│  - Deterministic Math Tools (JavaScript Arithmetic)    │
│  - Verification Engine (Audits claims vs Math Truth)   │
└────────────┬────────────────────────────▲──────────────┘
             │ Prompts with               │ Structured JSON
             │ Aggregated Context         │ Hypotheses & Actions
             ▼                            │
┌────────────────────────────────────────────────────────┐
│           Neatlogs-Wrapped Google GenAI                │
│  - Gemini 3.8 Flash model invocation                   │
│  - Transparent execution tracing via Neatlogs wrapper  │
│  - Strict retry & fallback error recovery              │
└────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Principles

### 2.1 Deterministic Arithmetic vs LLM Synthesis
- **No LLM Math Hallucination:** Language models are never asked to compute sums, subtractions, percentages, or ratios. All calculations are executed by dedicated, unit-tested JavaScript tools.
- **Strict Verification Layer (`verify-findings.js`):** Every numerical claim generated or summarized is cross-checked against exact mathematical ground truth.
- **Facts vs Hypotheses:** 
  * A **Verified Fact** represents an observed calculation in the dataset (e.g., *"Revenue dropped by ₦1,240,000 (-45%) in February due to an 80% volume drop in Parboiled Rice"*).
  * An **Actionable Hypothesis** represents unobserved operational factors (e.g., *"Did the supplier experience a stockout, or did customer orders get held up?"*). The agent explicitly labels these as hypotheses requiring merchant verification.
- **Accounting Integrity:** The system enforces an explicit disclaimer that **Cost of Goods Sold (COGS)** is not tracked in transaction logs; therefore, gross revenue is reported, and profit margins cannot be guessed.

---

## 3. Tool Contracts & Allowlist

The orchestrator enforces a strict tool allowlist:

| Tool Name | Module | Responsibility |
|---|---|---|
| `validate_sales` | `src/tools/validate-sales.js` | Normalizes dates, validates quantities and unit prices, detects duplicates, flags malformed rows. |
| `calculate_metrics` | `src/tools/calculate-metrics.js` | Computes completed gross revenue, order volume, cancellation counts, and AOV. |
| `compare_periods` | `src/tools/compare-periods.js` | Computes Month-over-Month deltas, percentages, and handles insufficient historical data edge cases. |
| `analyze_products` | `src/tools/analyze-products.js` | Attributes revenue delta to individual products (identifying top decliners and growth drivers). |
| `verify_findings` | `src/tools/verify-findings.js` | Cross-checks narrative claims against arithmetic, categorizing facts, hypotheses, and limitations. |

---

## 4. Single-Browser Prototype vs Production Multi-User Architecture

To ensure speed, simplicity, and zero setup friction for hackathon judges, SalesPulse AI is implemented as a **single-browser prototype**. Below is the distinction from a production system:

| Dimension | Hackathon Prototype (Current) | Production Architecture (Future) |
|---|---|---|
| **Data Storage** | Browser `localStorage` (client-side only). No server database. | Multi-tenant PostgreSQL with row-level security (RLS) or Supabase. |
| **Authentication** | Demo workspace, zero-login required. Immediate evaluation. | OAuth 2.0 / Passwordless Magic Links with role-based access control. |
| **Data Privacy** | Raw sales data remains in the user's browser; only necessary aggregated payloads are sent for investigation. | SOC2-compliant encrypted database at rest with tenancy isolation. |
| **Orchestration** | Synchronous HTTP POST request with structured timeline response. | Asynchronous background jobs (e.g. BullMQ / Redis) with Server-Sent Events (SSE) or WebSockets. |
| **Integrations** | 1-Click sample data, manual entry, and CSV file upload. | WhatsApp Business API webhooks, Instagram Direct Message automations, and Paystack/Moniepoint POS sync. |

---

## 5. Observability & Tracing (Neatlogs)

Every call to the Gemini model is routed through the initialized `wrapGoogleGenAI(gemini)` client:
- **Trace Context:** Agent runs include the objective, run ID, and step summaries.
- **Safe Tracing:** No API keys, passwords, or raw bulk CSV records are leaked into logs; only aggregated metrics and structured tool outputs are sent.
- **Neatlogs Dashboard:** Judges and developers can view the Neatlogs trace dashboard to review model inputs, token usage, latency, and response validation.
