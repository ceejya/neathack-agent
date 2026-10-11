/**
 * SalesPulse AI - Agent State Management
 * Maintains structured state for a single bounded investigation run.
 */

export class AgentState {
  constructor(objective, options = {}) {
    this.runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.objective = objective || "Investigate changes in sales performance and produce an action plan.";
    this.status = "initialized"; // 'initialized' | 'planning' | 'executing' | 'verifying' | 'completed' | 'failed'
    this.startTime = new Date().toISOString();
    this.endTime = null;
    this.plan = [];
    this.currentStepIndex = 0;
    this.timeline = []; // User-visible chronological steps
    this.toolResults = {};
    this.verifiedFindings = [];
    this.hypotheses = [];
    this.recommendations = [];
    this.dataLimitations = [];
    this.verificationIssues = [];
    this.errors = [];
    this.retryCount = 0;
    this.maxRetries = options.maxRetries || 2;
    this.metadata = {
      model: options.model || "gemini-3.8-flash",
      currency: "NGN",
      currencySymbol: "₦",
    };
  }

  addTimelineEntry({ stepName, toolName, status, summary, details = null }) {
    const entry = {
      id: `step_${this.timeline.length + 1}`,
      timestamp: new Date().toISOString(),
      stepName,
      toolName: toolName || null,
      status, // 'running' | 'success' | 'warning' | 'error'
      summary,
      details,
    };
    this.timeline.push(entry);
    return entry;
  }

  setPlan(steps) {
    this.plan = Array.isArray(steps) ? steps : [];
    this.status = "executing";
    this.addTimelineEntry({
      stepName: "Investigation Plan",
      status: "success",
      summary: `Created ${this.plan.length}-step structured investigation plan.`,
      details: { plan: this.plan },
    });
  }

  recordToolResult(toolName, result) {
    this.toolResults[toolName] = result;
  }

  recordError(error, context = "") {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      context,
      message: error.message || String(error),
      stack: error.stack,
    };
    this.errors.push(errorEntry);
    this.addTimelineEntry({
      stepName: context || "Execution Error",
      status: "error",
      summary: `Encountered issue: ${error.message || String(error)}`,
      details: { error: errorEntry },
    });
  }

  complete({ findings = [], hypotheses = [], recommendations = [], limitations = [] }) {
    this.endTime = new Date().toISOString();
    this.status = "completed";
    this.verifiedFindings = findings;
    this.hypotheses = hypotheses;
    this.recommendations = recommendations;
    this.dataLimitations = limitations;

    this.addTimelineEntry({
      stepName: "Investigation Report Finalized",
      status: "success",
      summary: `Synthesized ${findings.length} verified facts, ${hypotheses.length} hypotheses, and ${recommendations.length} action items.`,
    });
  }

  fail(reason) {
    this.endTime = new Date().toISOString();
    this.status = "failed";
    this.addTimelineEntry({
      stepName: "Investigation Failed",
      status: "error",
      summary: `Investigation could not complete: ${reason}`,
    });
  }

  toJSON() {
    return {
      runId: this.runId,
      objective: this.objective,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.endTime ? new Date(this.endTime).getTime() - new Date(this.startTime).getTime() : null,
      plan: this.plan,
      timeline: this.timeline,
      toolResults: this.toolResults,
      findings: this.verifiedFindings,
      hypotheses: this.hypotheses,
      recommendations: this.recommendations,
      dataLimitations: this.dataLimitations,
      verificationIssues: this.verificationIssues,
      errors: this.errors,
      metadata: this.metadata,
    };
  }
}
