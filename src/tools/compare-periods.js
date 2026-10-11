/**
 * SalesPulse AI - Period Comparison Tool
 * Compares two equivalent periods (e.g. Month-over-Month) with deterministic calculations.
 */

import { groupSalesByMonth, calculateSummaryMetrics } from "./calculate-metrics.js";

export function compareSalesPeriods(sales, options = {}) {
  const monthlyGroups = groupSalesByMonth(sales);
  const months = Object.keys(monthlyGroups).sort();

  if (months.length === 0) {
    return {
      canCompare: false,
      reason: "No sales data found to perform period comparison.",
      insufficientHistoricalData: true,
    };
  }

  let prevMonth = options.previousPeriod;
  let currMonth = options.currentPeriod;

  // If periods not explicitly provided, choose the last two available months
  if (!prevMonth || !currMonth) {
    if (months.length < 2) {
      return {
        canCompare: false,
        reason: `Dataset contains only 1 month of records (${months[0]}). At least 2 full periods are required to calculate trend and period-over-period changes.`,
        availableMonths: months,
        insufficientHistoricalData: true,
        singlePeriodMetrics: monthlyGroups[months[0]],
      };
    }

    currMonth = months[months.length - 1];
    prevMonth = months[months.length - 2];
  }

  const prevMetrics = monthlyGroups[prevMonth] || calculateSummaryMetrics([]);
  const currMetrics = monthlyGroups[currMonth] || calculateSummaryMetrics([]);

  const revenueDelta = currMetrics.totalRevenue - prevMetrics.totalRevenue;
  const revenuePercentChange =
    prevMetrics.totalRevenue > 0
      ? Number(((revenueDelta / prevMetrics.totalRevenue) * 100).toFixed(2))
      : currMetrics.totalRevenue > 0
      ? 100
      : 0;

  const ordersDelta = currMetrics.completedOrdersCount - prevMetrics.completedOrdersCount;
  const ordersPercentChange =
    prevMetrics.completedOrdersCount > 0
      ? Number(((ordersDelta / prevMetrics.completedOrdersCount) * 100).toFixed(2))
      : currMetrics.completedOrdersCount > 0
      ? 100
      : 0;

  const unitsDelta = currMetrics.totalUnitsSold - prevMetrics.totalUnitsSold;
  const unitsPercentChange =
    prevMetrics.totalUnitsSold > 0
      ? Number(((unitsDelta / prevMetrics.totalUnitsSold) * 100).toFixed(2))
      : currMetrics.totalUnitsSold > 0
      ? 100
      : 0;

  const aovDelta = currMetrics.averageOrderValue - prevMetrics.averageOrderValue;
  const aovPercentChange =
    prevMetrics.averageOrderValue > 0
      ? Number(((aovDelta / prevMetrics.averageOrderValue) * 100).toFixed(2))
      : 0;

  const cancellationRateDelta = currMetrics.cancellationRatePercent - prevMetrics.cancellationRatePercent;

  return {
    canCompare: true,
    insufficientHistoricalData: false,
    comparisonType: "Month-over-Month",
    previousPeriod: {
      period: prevMonth,
      metrics: prevMetrics,
    },
    currentPeriod: {
      period: currMonth,
      metrics: currMetrics,
    },
    changes: {
      revenue: {
        previous: prevMetrics.totalRevenue,
        current: currMetrics.totalRevenue,
        delta: revenueDelta,
        percentChange: revenuePercentChange,
        direction: revenueDelta > 0 ? "increase" : revenueDelta < 0 ? "decrease" : "flat",
      },
      orders: {
        previous: prevMetrics.completedOrdersCount,
        current: currMetrics.completedOrdersCount,
        delta: ordersDelta,
        percentChange: ordersPercentChange,
        direction: ordersDelta > 0 ? "increase" : ordersDelta < 0 ? "decrease" : "flat",
      },
      units: {
        previous: prevMetrics.totalUnitsSold,
        current: currMetrics.totalUnitsSold,
        delta: unitsDelta,
        percentChange: unitsPercentChange,
        direction: unitsDelta > 0 ? "increase" : unitsDelta < 0 ? "decrease" : "flat",
      },
      averageOrderValue: {
        previous: prevMetrics.averageOrderValue,
        current: currMetrics.averageOrderValue,
        delta: aovDelta,
        percentChange: aovPercentChange,
      },
      cancellationRate: {
        previous: prevMetrics.cancellationRatePercent,
        current: currMetrics.cancellationRatePercent,
        delta: Number(cancellationRateDelta.toFixed(2)),
      },
    },
    allAvailableMonths: months,
  };
}
