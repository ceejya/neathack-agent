# SalesPulse AI — Business Plan & Unit Economics Framework (cfo.ai)

> **Hackathon Notice:**  
> `cfo.ai` is a mandatory hackathon requirement for comprehensive financial modeling and business planning. This document outlines the baseline assumptions, unit economics, and cost structure prepared for input into `cfo.ai`.  
> *Status: Framework prepared; pending final output generation from the cfo.ai tool.*

---

## 1. Target Customer & Value Proposition

- **Ideal Customer Profile (ICP):** Small online social commerce sellers (food & provisions, fashion, beauty, electronics) operating across Instagram, WhatsApp, and TikTok in Nigeria and Sub-Saharan Africa.
- **Pain Point:** Lack of accounting knowledge, inability to use Excel or CSV tools, and blindness regarding why monthly sales drop or which products drive revenue.
- **Value Proposition:** An autonomous AI business analyst that translates transaction logs into verified facts, highlights exact product drivers, and provides prioritized steps to recover revenue.

---

## 2. Pricing & Packaging Assumptions

| Tier | Target User | Monthly Price (NGN) | USD Equivalent | Features |
|---|---|---|---|---|
| **Starter (Free)** | New merchants (< 50 orders/mo) | ₦0 | $0 | Browser workspace, manual entry, basic monthly KPI trends. |
| **Growth Pro** | Active sellers (50–500 orders/mo) | ₦8,500 / mo | ~$5.50 / mo | Unlimited AI investigations, WhatsApp weekly summary digests, CSV exports. |
| **Business Hub** | Multi-channel sellers (> 500 orders/mo) | ₦25,000 / mo | ~$16.00 / mo | Automated bank & Moniepoint/Paystack sync, team seats, inventory alerts. |

---

## 3. Cost Assumptions & Unit Economics

### 3.1 AI Inference & Computing Costs
- **Model:** Google Gemini Flash (`gemini-3.8-flash` / `gemini-2.0-flash`).
- **Input Tokens per Run:** ~1,200 tokens (aggregated sales summaries + prompt guardrails).
- **Output Tokens per Run:** ~600 tokens (structured JSON action plan).
- **Inference Cost per Run:** < $0.0003 (~₦0.45 per investigation).
- **Average Pro User Usage:** 8 investigations/month = **$0.0024/month per user**.

### 3.2 Hosting & Infrastructure Costs
- **App Hosting:** Node.js serverless/container (e.g. Render, Railway, Vercel) = ~$7.00 - $20.00/month baseline.
- **Database (Production):** Supabase / Neon PostgreSQL Serverless = ~$0 - $25.00/month.
- **Observability:** Neatlogs free/team tier for agent traces.

### 3.3 Gross Margins
- **Gross Margin per Paid Pro User:**
  - Revenue: $5.50
  - Direct COGS (AI tokens + compute): ~$0.15
  - **Gross Margin:** **> 95%**

---

## 4. Revenue Scenarios & Break-Even Targets

- **Scenario A (Conservative):** 100 paid merchants at Month 3 = ₦850,000/mo MRR ($550 MRR). Break-even achieved on fixed hosting and operational costs.
- **Scenario B (Target Growth):** 1,000 paid merchants at Month 12 = ₦8,500,000/mo MRR (~$5,500 MRR).
- **Next Step:** Upload these exact ICP parameters, tiers, and compute figures to `cfo.ai` to generate the official financial projections report.
