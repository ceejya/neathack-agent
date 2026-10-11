/**
 * SalesPulse AI - Data Validation Tool
 * Validates raw sales records, checks formats, normalizes fields, and detects anomalies.
 * Highly robust: supports UTF-8 BOM, delimiter auto-detection, header aliases,
 * currency symbol/comma stripping, and flexible date formats.
 */

// Common header alias mappings for real-world merchant CSVs
const HEADER_ALIASES = {
  date: [
    "date", "order date", "order_date", "transaction date", "transaction_date",
    "timestamp", "datetime", "created_at", "created at", "paid_at", "paid at",
    "trans_date", "day", "sales_date", "year", "invoice date", "order_time"
  ],
  product: [
    "product", "item", "product name", "product_name", "item name", "item_name",
    "lineitem name", "lineitem_name", "product_title", "title", "name", "description",
    "product_desc", "items", "details", "particulars", "variable", "industry_name_anzsic", "category"
  ],
  quantity: [
    "quantity", "qty", "units", "count", "volume", "quantity_sold", "pieces",
    "qty_sold", "units_sold", "num", "lineitem quantity", "lineitem_quantity", "number"
  ],
  unit_price: [
    "unit_price", "unit price", "unitprice", "price", "rate", "amount", "unit_cost",
    "cost", "selling_price", "price_per_unit", "unit_rate", "item_price",
    "lineitem price", "lineitem_price", "gross sales", "gross_sales", "net sales",
    "total", "order total", "subtotal", "value", "val"
  ],
  status: [
    "status", "order status", "order_status", "financial status", "financial_status",
    "state", "payment_status", "trans_status", "fulfillment status"
  ],
};

function cleanNumericValue(val) {
  if (typeof val === "number") return val;
  if (val === null || val === undefined) return NaN;
  // Strip currency symbols (₦, $, £, €, etc.), commas, spaces
  const cleaned = String(val)
    .replace(/[₦$£€,\s]/g, "")
    .trim();
  return Number(cleaned);
}

function normalizeDateValue(rawDate) {
  if (!rawDate) return null;
  if (rawDate instanceof Date) {
    return rawDate.toISOString().slice(0, 10);
  }
  if (typeof rawDate !== "string") return null;

  const trimmed = rawDate.trim();
  // Standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  // 4-digit year (e.g. 2011, 2026) -> treat as YYYY-01-01
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }
  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
    return trimmed.replace(/\//g, "-");
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback to JS Date parser
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function validateSalesRecords(records) {
  if (!Array.isArray(records)) {
    return {
      isValid: false,
      error: "Input records must be an array.",
      validSales: [],
      invalidRows: [],
      warnings: ["Input records was not an array."],
      duplicateCount: 0,
      dateRange: null,
    };
  }

  const validSales = [];
  const invalidRows = [];
  const warnings = [];
  const seenSignatures = new Set();
  let duplicateCount = 0;

  records.forEach((row, index) => {
    const rowNum = index + 1;

    if (!row || typeof row !== "object") {
      invalidRows.push({ row: rowNum, error: "Row is empty or not an object", raw: row });
      return;
    }

    // 1. Validate Product
    const product = typeof row.product === "string" ? row.product.trim() : "";
    if (!product) {
      invalidRows.push({ row: rowNum, error: "Missing or invalid 'product' name", raw: row });
      return;
    }

    // 2. Validate Quantity
    const qtyNum = cleanNumericValue(row.quantity);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      invalidRows.push({
        row: rowNum,
        error: `'quantity' must be a positive integer, received: '${row.quantity}'`,
        raw: row,
      });
      return;
    }

    // 3. Validate Unit Price
    const priceNum = cleanNumericValue(row.unit_price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      invalidRows.push({
        row: rowNum,
        error: `'unit_price' must be a non-negative number, received: '${row.unit_price}'`,
        raw: row,
      });
      return;
    }

    // 4. Validate Date
    const normalizedDate = normalizeDateValue(row.date);
    if (!normalizedDate) {
      invalidRows.push({
        row: rowNum,
        error: `'date' is not a recognized date format, received: '${row.date}'`,
        raw: row,
      });
      return;
    }

    // 5. Validate Status
    const rawStatus = typeof row.status === "string" ? row.status.trim().toLowerCase() : "completed";
    const allowedStatuses = ["completed", "cancelled", "pending", "refunded"];
    const status = allowedStatuses.includes(rawStatus) ? rawStatus : "completed";
    if (rawStatus && !allowedStatuses.includes(rawStatus)) {
      warnings.push(`Row ${rowNum}: Unknown status '${rawStatus}' defaulted to 'completed'.`);
    }

    // 6. Check duplicates
    const signature = `${normalizedDate}|${product.toLowerCase()}|${qtyNum}|${priceNum}|${status}`;
    let isDuplicate = false;
    if (seenSignatures.has(signature)) {
      duplicateCount += 1;
      isDuplicate = true;
      warnings.push(`Row ${rowNum}: Potential duplicate transaction detected (${product} on ${normalizedDate}).`);
    } else {
      seenSignatures.add(signature);
    }

    const lineRevenue = qtyNum * priceNum;

    validSales.push({
      id: row.id || `sale-${rowNum}-${Date.now().toString(36)}`,
      date: normalizedDate,
      product,
      quantity: qtyNum,
      unit_price: priceNum,
      status,
      lineRevenue,
      isDuplicate,
    });
  });

  // Calculate overall date range
  let dateRange = null;
  if (validSales.length > 0) {
    const dates = validSales.map((s) => s.date).sort();
    dateRange = {
      min: dates[0],
      max: dates[dates.length - 1],
    };
  }

  return {
    isValid: validSales.length > 0,
    validSales,
    invalidRows,
    warnings,
    duplicateCount,
    totalRecordsSubmitted: records.length,
    validRecordsCount: validSales.length,
    invalidRecordsCount: invalidRows.length,
    dateRange,
  };
}

/**
 * Parses CSV text safely into array of raw objects
 * Auto-detects delimiters (comma, semicolon, tab) and resolves header aliases.
 */
export function parseSalesCsvText(csvText) {
  if (typeof csvText !== "string" || !csvText.trim()) {
    return { records: [], parseErrors: ["Empty CSV content provided."] };
  }

  // Strip BOM (\uFEFF) if present
  const sanitized = csvText.replace(/^\uFEFF/, "").trim();

  // Split lines accounting for Windows / Mac / Linux line endings
  const lines = sanitized.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { records: [], parseErrors: ["CSV must contain a header row and at least one data row."] };
  }

  // Auto-detect delimiter from header line
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  let delimiter = ",";
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";

  // Parse header
  let rawHeaders = splitCsvLine(firstLine, delimiter).map((h) =>
    h.trim().replace(/^["']|["']$/g, "").toLowerCase()
  );

  // Strip trailing empty headers (from trailing commas e.g. ",,,,,,,,,")
  while (rawHeaders.length > 0 && rawHeaders[rawHeaders.length - 1] === "") {
    rawHeaders.pop();
  }

  // Map headers to canonical field names
  const canonicalMap = {};
  rawHeaders.forEach((rawHeader, idx) => {
    if (!rawHeader) return;
    const cleanHeader = rawHeader.toLowerCase().replace(/[\s_\-]+/g, " ").trim();
    for (const [canonicalKey, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(cleanHeader) || aliases.includes(rawHeader)) {
        canonicalMap[canonicalKey] = idx;
        break;
      }
    }
  });

  const requiredFields = ["date", "product", "unit_price"];
  const missingFields = requiredFields.filter((req) => canonicalMap[req] === undefined);

  if (missingFields.length > 0) {
    const isMacroSurvey = rawHeaders.some((h) => h.includes("anzsic") || h.includes("variable") || h.includes("rme_size"));
    let errorHelp = `Could not identify required sales transaction columns: ${missingFields.join(", ")}. Found headers: [${rawHeaders.filter(Boolean).join(", ")}].`;
    if (isMacroSurvey) {
      errorHelp += `\n\nNote: This uploaded data appears to be a macro-economic/survey dataset (Stats NZ) with fields like 'ANZSIC'. SalesPulse AI is designed to analyze product sales transactions (with date, product name, quantity, and unit price).`;
      errorHelp += `\nTip: Click the 'Load Sample Data' button to test with realistic sales records, or click 'Insert Sample Sales Template' to see the expected format!`;
    } else {
      errorHelp += ` Expected sales headers: date, product, unit_price (or item, price, amount).`;
    }
    return {
      records: [],
      parseErrors: [errorHelp],
    };
  }

  const records = [];
  const parseErrors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    let values = splitCsvLine(line, delimiter);

    // Strip trailing empty values beyond header count
    while (values.length > rawHeaders.length && values[values.length - 1] === "") {
      values.pop();
    }

    if (values.length < rawHeaders.length) {
      parseErrors.push(`Row ${i + 1}: Column count mismatch (expected ${rawHeaders.length}, got ${values.length}).`);
      continue;
    }

    const record = {
      date: values[canonicalMap.date] || "",
      product: values[canonicalMap.product] || "",
      quantity: canonicalMap.quantity !== undefined ? values[canonicalMap.quantity] : "1",
      unit_price: values[canonicalMap.unit_price] || "",
      status: canonicalMap.status !== undefined ? values[canonicalMap.status] : "completed",
    };

    records.push(record);
  }

  return { records, parseErrors };
}

/**
 * Splits a single CSV line respecting quotes and escaping
 */
function splitCsvLine(line, delimiter = ",") {
  const values = [];
  let insideQuote = false;
  let currentValue = "";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      insideQuote = !insideQuote;
    } else if (char === delimiter && !insideQuote) {
      values.push(currentValue.trim().replace(/^["']|["']$/g, ""));
      currentValue = "";
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue.trim().replace(/^["']|["']$/g, ""));
  return values;
}
