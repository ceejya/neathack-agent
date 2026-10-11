/**
 * SalesPulse AI - Deterministic Metrics Calculation Tool
 * Pure JavaScript arithmetic: strictly computes revenues, quantities, order counts,
 * and highlights that profit cannot be calculated without cost data.
 */

export function calculateSummaryMetrics(sales) {
  if (!Array.isArray(sales) || sales.length === 0) {
    return {
      totalRevenue: 0,
      completedOrdersCount: 0,
      totalOrdersCount: 0,
      cancelledOrdersCount: 0,
      cancellationRatePercent: 0,
      totalUnitsSold: 0,
      averageOrderValue: 0,
      averageUnitsPerOrder: 0,
      dateRange: null,
      profitDisclaimer: "IMPORTANT: Profit and profit margins cannot be calculated because cost of goods sold (COGS) is not tracked in this dataset.",
    };
  }

  let totalRevenue = 0;
  let cancelledRevenue = 0;
  let completedOrdersCount = 0;
  let cancelledOrdersCount = 0;
  let otherStatusOrdersCount = 0;
  let totalUnitsSold = 0;

  sales.forEach((item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const lineRev = qty * price;
    const status = (item.status || "completed").toLowerCase();

    if (status === "completed") {
      totalRevenue += lineRev;
      completedOrdersCount += 1;
      totalUnitsSold += qty;
    } else if (status === "cancelled") {
      cancelledRevenue += lineRev;
      cancelledOrdersCount += 1;
    } else {
      otherStatusOrdersCount += 1;
    }
  });

  const totalOrdersCount = sales.length;
  const cancellationRatePercent =
    totalOrdersCount > 0 ? Number(((cancelledOrdersCount / totalOrdersCount) * 100).toFixed(2)) : 0;

  const averageOrderValue =
    completedOrdersCount > 0 ? Math.round((totalRevenue / completedOrdersCount) * 100) / 100 : 0;

  const averageUnitsPerOrder =
    completedOrdersCount > 0 ? Number((totalUnitsSold / completedOrdersCount).toFixed(2)) : 0;

  const dates = sales.map((s) => s.date).filter(Boolean).sort();
  const dateRange = dates.length > 0 ? { start: dates[0], end: dates[dates.length - 1] } : null;

  return {
    totalRevenue,
    cancelledRevenue,
    completedOrdersCount,
    totalOrdersCount,
    cancelledOrdersCount,
    otherStatusOrdersCount,
    cancellationRatePercent,
    totalUnitsSold,
    averageOrderValue,
    averageUnitsPerOrder,
    dateRange,
    profitDisclaimer:
      "IMPORTANT: Revenue represents total gross sales from completed orders. Profit and profit margin cannot be calculated without cost/COGS data.",
  };
}

/**
 * Groups sales records by month (YYYY-MM) with deterministic aggregation
 */
export function groupSalesByMonth(sales) {
  if (!Array.isArray(sales)) return {};

  const monthlyMap = {};

  sales.forEach((item) => {
    if (!item.date) return;
    const monthKey = item.date.slice(0, 7); // 'YYYY-MM'
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = [];
    }
    monthlyMap[monthKey].push(item);
  });

  const months = Object.keys(monthlyMap).sort();
  const result = {};

  months.forEach((month) => {
    const monthSales = monthlyMap[month];
    const metrics = calculateSummaryMetrics(monthSales);
    result[month] = {
      month,
      recordsCount: monthSales.length,
      ...metrics,
    };
  });

  return result;
}
