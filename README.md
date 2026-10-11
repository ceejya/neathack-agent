# SalesPulse AI

> **Tagline:** Understand your sales. Investigate the changes. Decide what to do next.  
> **neatHack Hackathon Project**

SalesPulse AI is an AI-powered business analyst designed for small online merchants who sell products through Instagram, WhatsApp, and social commerce channels. It investigates sales performance changes, identifies which products drove revenue drops or growth, verifies findings using deterministic JavaScript arithmetic, and produces prioritized, evidence-backed action plans.

---

## Key Features

1. **Zero-Spreadsheet Requirement:** Built for merchants who don't understand pivot tables or formulas. Add sales manually, upload an optional CSV, or load sample data in 1 click.
2. **Deterministic Arithmetic:** The language model is never allowed to do arithmetic or guess numbers. JavaScript tools calculate revenue, Month-over-Month changes, product contributions, and cancellation rates.
3. **Evidence-Backed Verification:** The agent audits its findings against ground truth, explicitly distinguishing **Verified Facts** from **Actionable Hypotheses** and noting **Data Boundaries**.
4. **Visual Investigation Timeline:** Users can watch the agent execute its plan step-by-step in real time.
5. **Full Observability with Neatlogs:** All Gemini model calls are traced through the integrated Neatlogs wrapper for end-to-end auditability.
6. **Privacy-First Demo Workspace:** Sales records are stored in the browser's `localStorage`. No customer database is required for the demo.

---

## Project Structure

```text
neathack-agent/
├── index.js                      # Application entry point (Express + Neatlogs + Gemini)
├── package.json                  # Dependencies and test script
├── public/                       # SaaS Dashboard Frontend
│   ├── index.html                # Responsive semantic HTML dashboard
│   ├── style.css                 # Clean design system (light mode, emerald accents)
│   └── script.js                 # Client controller, storage, and timeline renderer
├── src/
│   ├── routes/
│   │   └── sales.routes.js       # Endpoints: /sample, /validate, /analyze
│   ├── agent/
│   │   ├── orchestrator.js       # Bounded tool loop & fallback recovery
│   │   ├── agent-state.js        # Investigation state machine & timeline
│   │   └── prompts.js            # Structured prompts & JSON schema
│   └── tools/
│       ├── validate-sales.js     # Validates records, dates, and duplicates
│       ├── calculate-metrics.js  # Computes revenues, orders, and AOV
│       ├── compare-periods.js    # Month-over-Month period comparison
│       ├── analyze-products.js   # Product-level revenue contribution
│       └── verify-findings.js    # Ground-truth mathematical verification
├── data/
│   └── sample-sales.csv          # Realistic 4-month Nigerian grocery dataset
├── tests/
│   ├── sales-analysis.test.js    # Deterministic unit and edge-case tests
│   └── api-routes.test.js        # Route and recovery integration tests
└── docs/
    ├── architecture.md           # Deep-dive architecture and design principles
    ├── demo-plan.md              # 3-minute hackathon judge demo script
    └── cfo-plan.md               # Unit economics and cfo.ai framework
```

---

## Quickstart & Local Setup

### 1. Prerequisites
- Node.js v18+ (tested on Node v24)
- Google Gemini API Key (`GEMINI_API_KEY`)
- Neatlogs API Key (`NEATLOGS_API_KEY`)

Ensure your `.env` file contains:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_key
NEATLOGS_API_KEY=your_neatlogs_key
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Automated Tests
Execute the 15 automated unit and integration tests using Node's native test runner:
```bash
npm test
```

### 4. Start the Application Server
```bash
npm start
```
Or with auto-reload:
```bash
npm run dev
```

### 5. Access the Dashboard
Open your browser and navigate to:
```
http://localhost:3000
```

---

## Endpoints Summary

- `GET /` — Serves the SalesPulse AI SaaS Dashboard (`public/index.html`).
- `GET /api/health` — Server health check.
- `GET /api/sales/sample` — Returns the synthetic 4-month Nigerian store dataset.
- `POST /api/sales/validate` — Validates sales records or CSV text quickly.
- `POST /api/sales/analyze` — Runs the full bounded autonomous AI investigation loop.
- `POST /research` — Preserved baseline NeatHack research endpoint.

---

## Neatlogs Traces & Entire Checkpoints

- **Neatlogs:** Every agent investigation routes through the wrapped Gemini client. Traces are visible in your Neatlogs dashboard under workflow `neathack-research-agent`.
- **Entire CLI:** Configured in `.entire/settings.local.json` with `push_sessions: false` for strict privacy. Checkpoints are recorded locally via git-refs.
