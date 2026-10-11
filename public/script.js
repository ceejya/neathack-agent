/**
 * SalesPulse AI - Frontend Application Controller
 * Handles local state persistence in localStorage, UI rendering, sample data loading,
 * manual sales entry, CSV uploads, and live investigation timeline visualization.
 */

// Local Storage Key
const STORAGE_KEY = "salespulse_records_v1";

// State
let salesRecords = [];
let currentInvestigation = null;

// Currency Formatter
const formatNaira = (amount) => {
  return "₦" + Number(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  loadStoredRecords();
  initEventListeners();
  updateDashboardUI();
});

function loadStoredRecords() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      salesRecords = JSON.parse(stored);
    }
  } catch (err) {
    console.error("Failed to parse stored sales records:", err);
    salesRecords = [];
  }
}

function saveStoredRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(salesRecords));
  } catch (err) {
    console.error("Failed to save records to localStorage:", err);
  }
}

function initEventListeners() {
  // Navigation links
  document.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", (e) => {
      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      link.classList.add("active");
    });
  });

  // Action Buttons
  document.getElementById("btn-load-sample")?.addEventListener("click", handleLoadSampleData);
  document.getElementById("btn-empty-load-sample")?.addEventListener("click", handleLoadSampleData);
  document.getElementById("btn-open-add-sale")?.addEventListener("click", () => openModal("modal-add-sale"));
  document.getElementById("btn-open-csv")?.addEventListener("click", () => openModal("modal-import-csv"));
  document.getElementById("btn-clear-data")?.addEventListener("click", handleClearData);
  document.getElementById("btn-run-investigation")?.addEventListener("click", handleRunInvestigation);

  // Quick prompt chips
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      const input = document.getElementById("investigation-objective");
      if (input && prompt) {
        input.value = prompt;
      }
    });
  });

  // Modal close handlers
  document.getElementById("btn-close-modal-add")?.addEventListener("click", () => closeModal("modal-add-sale"));
  document.getElementById("btn-cancel-modal-add")?.addEventListener("click", () => closeModal("modal-add-sale"));
  document.getElementById("btn-close-modal-csv")?.addEventListener("click", () => closeModal("modal-import-csv"));
  document.getElementById("btn-cancel-modal-csv")?.addEventListener("click", () => closeModal("modal-import-csv"));
  document.getElementById("btn-insert-sample-csv")?.addEventListener("click", () => {
    const textarea = document.getElementById("csv-raw-textarea");
    if (textarea) {
      textarea.value = `date,product,quantity,unit_price,status
2026-01-05,Parboiled Rice 25kg,20,38000,completed
2026-01-10,Pure Vegetable Oil 5L,30,14500,completed
2026-01-15,Tomato Paste Carton,40,9500,completed
2026-01-20,Seasoning Cubes Pack,50,4200,completed
2026-02-05,Parboiled Rice 25kg,6,38000,completed
2026-02-10,Pure Vegetable Oil 5L,32,14500,completed
2026-02-15,Parboiled Rice 25kg,8,38000,cancelled
2026-02-20,Tomato Paste Carton,42,9500,completed`;
      const errBox = document.getElementById("csv-error-feedback");
      if (errBox) errBox.style.display = "none";
    }
  });
  document.getElementById("btn-close-banner")?.addEventListener("click", () => {
    const banner = document.getElementById("info-banner");
    if (banner) banner.style.display = "none";
  });

  // Close modals on outside click
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) {
      e.target.style.display = "none";
    }
  });

  // Form: Add Sale
  const formAddSale = document.getElementById("form-add-sale");
  formAddSale?.addEventListener("submit", handleAddSaleSubmit);

  // Set default date for Add Sale form to today
  const dateInput = document.getElementById("sale-date");
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  // CSV Drag & Drop / File Input
  const dropZone = document.getElementById("csv-drop-zone");
  const fileInput = document.getElementById("csv-file-input");

  dropZone?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", handleCsvFileSelect);

  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer?.files?.length) {
      handleCsvFile(e.dataTransfer.files[0]);
    }
  });

  document.getElementById("btn-process-csv")?.addEventListener("click", handleProcessCsvModal);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "flex";
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}

// ---------------- Load Sample Data ----------------
async function handleLoadSampleData() {
  try {
    const btn = document.getElementById("btn-load-sample");
    if (btn) btn.disabled = true;

    const res = await fetch("/api/sales/sample");
    const data = await res.json();

    if (data.records && Array.isArray(data.records)) {
      salesRecords = data.records;
      saveStoredRecords();
      updateDashboardUI();
      showNotification(`Successfully loaded ${salesRecords.length} realistic store records!`, "success");
    } else {
      showNotification("Could not load sample dataset.", "error");
    }
  } catch (err) {
    console.error("Error loading sample data:", err);
    showNotification("Failed to load sample dataset from server.", "error");
  } finally {
    const btn = document.getElementById("btn-load-sample");
    if (btn) btn.disabled = false;
  }
}

// ---------------- Add Individual Sale ----------------
function handleAddSaleSubmit(e) {
  e.preventDefault();
  const date = document.getElementById("sale-date").value;
  const product = document.getElementById("sale-product").value.trim();
  const quantity = parseInt(document.getElementById("sale-quantity").value, 10);
  const unit_price = parseFloat(document.getElementById("sale-unit-price").value);
  const status = document.getElementById("sale-status").value;

  if (!date || !product || isNaN(quantity) || quantity <= 0 || isNaN(unit_price) || unit_price < 0) {
    alert("Please enter valid sales transaction fields.");
    return;
  }

  const newSale = {
    id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    date,
    product,
    quantity,
    unit_price,
    status,
    lineRevenue: quantity * unit_price,
  };

  salesRecords.unshift(newSale);
  saveStoredRecords();
  updateDashboardUI();
  closeModal("modal-add-sale");

  // Reset form inputs except date
  document.getElementById("sale-product").value = "";
  document.getElementById("sale-quantity").value = "1";
  document.getElementById("sale-unit-price").value = "";

  showNotification(`Recorded sale for ${product}!`, "success");
}

function handleCsvFileSelect(e) {
  if (e.target?.files?.length) {
    handleCsvFile(e.target.files[0]);
  }
}

function handleCsvFile(file) {
  const isCsvName = file.name && file.name.toLowerCase().endsWith(".csv");
  const isTxtName = file.name && file.name.toLowerCase().endsWith(".txt");
  const isCsvType = file.type && (file.type.includes("csv") || file.type.includes("excel") || file.type.includes("text"));

  if (!isCsvName && !isTxtName && !isCsvType) {
    showCsvError("Please select a valid CSV file (.csv or .txt).");
    return;
  }

  const dropZoneP = document.querySelector("#csv-drop-zone p");
  if (dropZoneP) {
    dropZoneP.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024) || 1} KB)`;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target?.result;
    const textarea = document.getElementById("csv-raw-textarea");
    if (textarea) textarea.value = text;
    const errorBox = document.getElementById("csv-error-feedback");
    if (errorBox) errorBox.style.display = "none";
  };
  reader.readAsText(file);
}

async function handleProcessCsvModal() {
  const textarea = document.getElementById("csv-raw-textarea");
  const csvText = textarea?.value?.trim();
  const errorBox = document.getElementById("csv-error-feedback");
  const processBtn = document.getElementById("btn-process-csv");

  if (errorBox) errorBox.style.display = "none";

  if (!csvText) {
    showCsvError("Please select a CSV file or paste CSV rows into the text box.");
    return;
  }

  try {
    if (processBtn) {
      processBtn.disabled = true;
      processBtn.textContent = "Validating...";
    }

    const res = await fetch("/api/sales/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const errorMsg = data.error || (data.parseErrors && data.parseErrors.join("\n")) || "Validation failed.";
      showCsvError(errorMsg);
      return;
    }

    if (data.validation && data.validation.validSales && data.validation.validSales.length > 0) {
      salesRecords = data.validation.validSales;
      saveStoredRecords();
      updateDashboardUI();
      closeModal("modal-import-csv");

      let msg = `Imported ${salesRecords.length} records successfully!`;
      if (data.validation.invalidRecordsCount > 0) {
        msg += ` (${data.validation.invalidRecordsCount} invalid rows skipped)`;
      }
      showNotification(msg, "success");
    } else {
      showCsvError("No valid sales records could be extracted. Please check date, product, quantity, and unit price values.");
    }
  } catch (err) {
    console.error("CSV process error:", err);
    showCsvError("Network error while connecting to server. Please verify the server is running.");
  } finally {
    if (processBtn) {
      processBtn.disabled = false;
      processBtn.textContent = "Process CSV";
    }
  }
}

function showCsvError(msg) {
  const errorBox = document.getElementById("csv-error-feedback");
  if (errorBox) {
    errorBox.style.display = "block";
    errorBox.innerText = msg;
  }
}

function handleClearData() {
  if (confirm("Clear all sales data in this demo workspace?")) {
    salesRecords = [];
    saveStoredRecords();
    updateDashboardUI();
    document.getElementById("reports").style.display = "none";
    document.getElementById("timeline-container").style.display = "none";
    showNotification("Workspace data cleared.", "neutral");
  }
}

// ---------------- UI Dashboard Rendering ----------------
function updateDashboardUI() {
  // 1. Calculations
  let totalRevenue = 0;
  let completedOrders = 0;
  let cancelledOrders = 0;
  let totalUnits = 0;
  const productMap = {};
  const monthlyMap = {};

  salesRecords.forEach((item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const status = (item.status || "completed").toLowerCase();
    const lineRev = qty * price;
    const name = item.product || "Unknown Product";

    // Monthly bucket
    const month = (item.date || "").slice(0, 7);
    if (month) {
      if (!monthlyMap[month]) monthlyMap[month] = { completedRevenue: 0, orders: 0 };
    }

    if (status === "completed") {
      totalRevenue += lineRev;
      completedOrders += 1;
      totalUnits += qty;

      if (month) {
        monthlyMap[month].completedRevenue += lineRev;
        monthlyMap[month].orders += 1;
      }

      if (!productMap[name]) {
        productMap[name] = { product: name, units: 0, revenue: 0, orders: 0 };
      }
      productMap[name].units += qty;
      productMap[name].revenue += lineRev;
      productMap[name].orders += 1;
    } else if (status === "cancelled") {
      cancelledOrders += 1;
    }
  });

  const totalOrders = salesRecords.length;
  const cancelRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : 0;
  const avgBasket = completedOrders > 0 ? (totalUnits / completedOrders).toFixed(1) : 0;

  // 2. Update KPI Elements
  const kpiRev = document.getElementById("kpi-revenue");
  if (kpiRev) kpiRev.textContent = formatNaira(totalRevenue);

  const kpiOrders = document.getElementById("kpi-orders");
  if (kpiOrders) kpiOrders.textContent = completedOrders.toLocaleString();

  const kpiUnits = document.getElementById("kpi-units");
  if (kpiUnits) kpiUnits.textContent = totalUnits.toLocaleString();

  const kpiCancel = document.getElementById("kpi-cancellation");
  if (kpiCancel) kpiCancel.textContent = `${cancelRate}%`;

  const kpiOrdersSub = document.getElementById("kpi-orders-subtext");
  if (kpiOrdersSub) {
    kpiOrdersSub.innerHTML = `<span class="kpi-subtext">${cancelledOrders} cancelled orders (${salesRecords.length} total)</span>`;
  }

  const kpiUnitsSub = document.getElementById("kpi-units-subtext");
  if (kpiUnitsSub) {
    kpiUnitsSub.innerHTML = `<span class="kpi-subtext">Average basket: ${avgBasket} units / order</span>`;
  }

  // 3. Render Monthly Bars
  renderMonthlyBars(monthlyMap);

  // 4. Render Product Table
  renderProductSummaryTable(productMap);

  // 5. Render Transaction Table
  renderTransactionsTable();
}

function renderMonthlyBars(monthlyMap) {
  const container = document.getElementById("monthly-bars-container");
  if (!container) return;

  const months = Object.keys(monthlyMap).sort();
  if (months.length === 0) {
    container.innerHTML = `<div class="empty-state-small">No monthly records yet. Load sample data or add sales.</div>`;
    return;
  }

  const maxRev = Math.max(...months.map((m) => monthlyMap[m].completedRevenue), 1);
  let html = "";

  months.forEach((m, idx) => {
    const data = monthlyMap[m];
    const pct = Math.max(Math.round((data.completedRevenue / maxRev) * 100), 5);
    const isLast = idx === months.length - 1;
    const isDecline = idx > 0 && data.completedRevenue < monthlyMap[months[idx - 1]].completedRevenue;

    html += `
      <div class="bar-col">
        <span class="bar-val">${formatNaira(data.completedRevenue)}</span>
        <div class="bar-pill ${isDecline ? "decline" : ""}" style="height: ${pct}%;" title="${m}: ${formatNaira(data.completedRevenue)}"></div>
        <span class="bar-label">${m}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderProductSummaryTable(productMap) {
  const tbody = document.getElementById("product-summary-tbody");
  if (!tbody) return;

  const products = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center empty-cell">No products recorded.</td></tr>`;
    return;
  }

  let html = "";
  products.forEach((p) => {
    const avgPrice = p.units > 0 ? Math.round(p.revenue / p.units) : 0;
    html += `
      <tr>
        <td><strong>${escapeHtml(p.product)}</strong></td>
        <td>${p.units.toLocaleString()}</td>
        <td>${formatNaira(avgPrice)}</td>
        <td><strong>${formatNaira(p.revenue)}</strong></td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderTransactionsTable() {
  const tbody = document.getElementById("sales-records-tbody");
  const subtitle = document.getElementById("sales-table-subtitle");
  if (!tbody) return;

  if (subtitle) {
    subtitle.textContent = `Showing ${salesRecords.length} records in browser workspace.`;
  }

  if (salesRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center empty-cell">
          <div class="empty-state">
            <p>No sales records in workspace yet.</p>
            <button class="btn btn-secondary btn-sm" id="btn-empty-load-sample-inline">Load 4-Month Sample Data</button>
          </div>
        </td>
      </tr>
    `;
    document.getElementById("btn-empty-load-sample-inline")?.addEventListener("click", handleLoadSampleData);
    return;
  }

  let html = "";
  // Show up to 25 most recent sales
  const displayRecords = salesRecords.slice(0, 25);

  displayRecords.forEach((item, index) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const lineRev = qty * price;
    const status = (item.status || "completed").toLowerCase();

    html += `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td><strong>${escapeHtml(item.product)}</strong></td>
        <td>${qty}</td>
        <td>${formatNaira(price)}</td>
        <td><strong>${formatNaira(lineRev)}</strong></td>
        <td><span class="status-tag ${status}">${status}</span></td>
        <td>
          <button class="btn-delete" data-index="${index}" title="Remove record">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      </tr>
    `;
  });

  if (salesRecords.length > 25) {
    html += `<tr><td colspan="7" class="text-center" style="font-size:0.8rem;color:#64748b;padding:0.75rem;">+ ${salesRecords.length - 25} more records in dataset.</td></tr>`;
  }

  tbody.innerHTML = html;

  // Delete record event handlers
  tbody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      salesRecords.splice(idx, 1);
      saveStoredRecords();
      updateDashboardUI();
    });
  });
}

// ---------------- Run Agent Investigation ----------------
async function handleRunInvestigation() {
  if (salesRecords.length === 0) {
    alert("Please load sample data or enter sales records before investigating.");
    return;
  }

  const objectiveInput = document.getElementById("investigation-objective");
  const objective = objectiveInput?.value?.trim() || "Why did my revenue fall last month, and what should I do next?";

  const runBtn = document.getElementById("btn-run-investigation");
  const runningBox = document.getElementById("investigation-running");
  const timelineContainer = document.getElementById("timeline-container");
  const reportPanel = document.getElementById("reports");

  if (runBtn) runBtn.disabled = true;
  if (runningBox) runningBox.style.display = "flex";
  if (timelineContainer) timelineContainer.style.display = "block";
  if (reportPanel) reportPanel.style.display = "none";

  const timelineFeed = document.getElementById("timeline-feed");
  if (timelineFeed) timelineFeed.innerHTML = "";

  try {
    const response = await fetch("/api/sales/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: salesRecords,
        objective,
      }),
    });

    const result = await response.json();
    currentInvestigation = result;

    if (!response.ok) {
      throw new Error(result.error || "Investigation request failed.");
    }

    // Render Timeline Feed
    renderInvestigationTimeline(result.timeline || []);

    // Render Full Verified Report
    renderInvestigationReport(result);

    if (reportPanel) {
      reportPanel.style.display = "flex";
      reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (err) {
    console.error("Investigation run failed:", err);
    if (timelineFeed) {
      timelineFeed.innerHTML += `
        <div class="timeline-step">
          <div class="step-header">
            <span class="step-title" style="color:#e11d48;">Investigation Error</span>
          </div>
          <div class="step-summary">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
    showNotification("Investigation encountered an error. Check server logs.", "error");
  } finally {
    if (runBtn) runBtn.disabled = false;
    if (runningBox) runningBox.style.display = "none";
  }
}

function renderInvestigationTimeline(timeline) {
  const container = document.getElementById("timeline-feed");
  if (!container) return;

  let html = "";
  timeline.forEach((step) => {
    html += `
      <div class="timeline-step">
        <div class="step-header">
          <span class="step-title">${escapeHtml(step.stepName)}</span>
          ${step.toolName ? `<span class="step-tool-badge">${escapeHtml(step.toolName)}</span>` : ""}
        </div>
        <div class="step-summary">${escapeHtml(step.summary)}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderInvestigationReport(result) {
  const runBadge = document.getElementById("report-run-badge");
  if (runBadge) runBadge.textContent = `Run ID: ${result.runId}`;

  const durEl = document.getElementById("report-duration");
  if (durEl && result.durationMs) {
    durEl.textContent = `Completed in ${result.durationMs}ms`;
  }

  // Executive summary
  const summaryText = document.getElementById("executive-summary-text");
  if (summaryText) {
    const firstFact = result.findings?.[0]?.claim || "Analysis completed.";
    summaryText.textContent = firstFact;
  }

  // 1. Verified Facts List
  const factsList = document.getElementById("verified-facts-list");
  if (factsList) {
    if (!result.findings || result.findings.length === 0) {
      factsList.innerHTML = `<div class="empty-state-small">No verified claims found.</div>`;
    } else {
      let factsHtml = "";
      result.findings.forEach((f) => {
        factsHtml += `
          <div class="finding-card">
            <span class="finding-metric">${escapeHtml(f.metric || "Metric")}</span>
            <span class="finding-claim">${escapeHtml(f.claim)}</span>
            ${f.evidence ? `<span class="finding-evidence">Evidence: ${escapeHtml(JSON.stringify(f.evidence))}</span>` : ""}
          </div>
        `;
      });
      factsList.innerHTML = factsHtml;
    }
  }

  // 2. Actionable Hypotheses List
  const hypList = document.getElementById("hypotheses-list");
  if (hypList) {
    if (!result.hypotheses || result.hypotheses.length === 0) {
      hypList.innerHTML = `<div class="empty-state-small">No operational hypotheses formulated.</div>`;
    } else {
      let hypHtml = "";
      result.hypotheses.forEach((h) => {
        hypHtml += `
          <div class="hypothesis-card">
            <div class="hypothesis-title">${escapeHtml(h.title || "Factor to Investigate")}</div>
            <div class="hypothesis-desc">${escapeHtml(h.description || "")}</div>
            <div class="hypothesis-action">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
              <span>Suggested check: ${escapeHtml(h.suggestedAction || "")}</span>
            </div>
          </div>
        `;
      });
      hypList.innerHTML = hypHtml;
    }
  }

  // 3. Prioritized Recommendations List
  const recList = document.getElementById("recommendations-list");
  if (recList) {
    if (!result.recommendations || result.recommendations.length === 0) {
      recList.innerHTML = `<div class="empty-state-small">No recommendations generated.</div>`;
    } else {
      let recHtml = "";
      result.recommendations.forEach((r) => {
        const priority = r.priority || "MEDIUM";
        recHtml += `
          <div class="rec-card">
            <div class="rec-card-top">
              <span class="rec-priority ${priority}">${priority} PRIORITY</span>
            </div>
            <h4 class="rec-title">${escapeHtml(r.title)}</h4>
            <p class="rec-action">${escapeHtml(r.action)}</p>
            ${r.expectedImpact ? `<p class="rec-impact">⚡ Impact: ${escapeHtml(r.expectedImpact)}</p>` : ""}
            <p class="rec-evidence">Data Evidence: ${escapeHtml(r.evidence)}</p>
          </div>
        `;
      });
      recList.innerHTML = recHtml;
    }
  }

  // 4. Data Boundaries & Limitations
  const limitList = document.getElementById("limitations-list");
  if (limitList) {
    if (!result.dataLimitations || result.dataLimitations.length === 0) {
      limitList.innerHTML = `<p class="limitation-item">No explicit constraints noted.</p>`;
    } else {
      let limitHtml = "";
      result.dataLimitations.forEach((lim) => {
        limitHtml += `
          <p class="limitation-item">• <strong>${escapeHtml(lim.category)}:</strong> ${escapeHtml(lim.message)}</p>
        `;
      });
      limitList.innerHTML = limitHtml;
    }
  }
}

// ---------------- Helper Utilities ----------------
function showNotification(msg, type = "success") {
  const notif = document.createElement("div");
  notif.style.position = "fixed";
  notif.style.bottom = "24px";
  notif.style.right = "24px";
  notif.style.padding = "12px 20px";
  notif.style.borderRadius = "8px";
  notif.style.color = "#ffffff";
  notif.style.fontSize = "0.875rem";
  notif.style.fontWeight = "600";
  notif.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1)";
  notif.style.zIndex = "9999";
  notif.style.transition = "opacity 0.3s ease";
  notif.style.backgroundColor = type === "error" ? "#e11d48" : type === "neutral" ? "#334155" : "#059669";
  notif.textContent = msg;

  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.opacity = "0";
    setTimeout(() => notif.remove(), 300);
  }, 3200);
}

function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
