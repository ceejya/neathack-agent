# SalesPulse AI — neatHack Live Demonstration Plan

**Demonstrator:** neatHack Hackathon Pair  
**Product:** SalesPulse AI  
**Goal:** Deliver a compelling, evidence-backed 3-minute demo proving agent autonomy, transparent execution, and deterministic accuracy.

---

## 1. Demo Narrative Arc (3-Minute Script)

### Step 1: The Small Merchant Problem (30s)
> *"Small online merchants in Nigeria and across Africa sell millions in goods through Instagram, WhatsApp, and TikTok. But when sales drop, they don't have a team of financial analysts, and they don't know how to build pivot tables or write spreadsheet formulas.*  
> *They ask a simple question: 'Why did my sales drop last month, and what should I do next?'*  
> *Enter **SalesPulse AI**."*

### Step 2: Zero-Friction Setup & Data Ingestion (45s)
1. **Open `http://localhost:3000`:**
   - Point out the clean SaaS design: light off-white layout, emerald-green accents, and clear workspace notice.
   - Highlight the banner: *"No spreadsheets required: Add sales one by one or load sample data with 1 click. CSV is optional."*
2. **Click "Load Sample Data":**
   - Instantly loads 38 real-world transactions spanning November 2025 through February 2026.
   - Shows Nigerian Naira (`₦`), realistic food items (*Parboiled Rice 25kg*, *Pure Vegetable Oil 5L*, etc.), and a visible revenue dip in February.
3. **Show Manual Entry ("Add Sale"):**
   - Click **Add Sale**, record a quick test sale, and watch the KPI cards and product breakdown update instantly in real time without refreshing.

### Step 3: Running the Autonomous AI Investigation (60s)
1. **Point to the Investigation Box:**
   - Objective: *"Why did my revenue fall last month, and what should I do next?"*
2. **Click "Investigate Sales":**
   - Highlight the **Execution Timeline**:
     * Step 1: `validate_sales` validates records, date span, and flags duplicates.
     * Step 2: `calculate_metrics` computes gross revenue and completed order volume.
     * Step 3: `compare_periods` compares January 2026 vs February 2026.
     * Step 4: `analyze_products` pinpoints *Parboiled Rice 25kg* as the primary negative driver.
     * Step 5: `verify_findings` mathematically audits every claim against ground truth.
     * Step 6: `synthesize_report` creates prioritized action items using Gemini 3.8 Flash.
3. **Explain Bounded Tool Execution:**
   - *"Notice that the model is never allowed to do arithmetic or guess revenue numbers. Pure JavaScript functions calculate the math, and the model synthesizes verified insights."*

### Step 4: Reviewing Verified Findings & Action Plan (45s)
1. **Show the Report Panel:**
   - **Verified Facts:** Mathematically proven claims (e.g., exact revenue drop, order reduction, and *Parboiled Rice 25kg* contribution).
   - **Actionable Hypotheses:** Explicitly distinguishes facts from unobserved causes (e.g., potential supplier stockout vs marketing changes).
   - **Prioritized Recommendations:** Actionable advice with priority tags (`HIGH`, `MEDIUM`, `LOW`) and supporting evidence.
   - **Accounting Disclaimer:** Confirms that without COGS data, profit margins cannot be assumed.

### Step 5: Traces & Observability in Neatlogs
1. Open the **Neatlogs** dashboard to display the real-time execution trace for the agent run.
2. Show that all model calls are logged under the configured workflow (`neathack-research-agent`), proving that the agent executed live during the evaluation.
