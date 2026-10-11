/**
 * SalesPulse AI - Product Performance and Contribution Analysis Tool
 * Computes product-level metrics and identifies exact contributions to revenue changes.
 */

export function analyzeProductPerformance(sales) {
  if (!Array.isArray(sales) || sales.length === 0) {
    return {
      products: [],
      productCount: 0,
      topRevenueProduct: null,
      topVolumeProduct: null,
    };
  }

  const map = {};

  sales.forEach((item) => {
    const name = item.product;
    if (!map[name]) {
      map[name] = {
        product: name,
        completedRevenue: 0,
        cancelledRevenue: 0,
        completedQuantity: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        pricesSeen: new Set(),
      };
    }

    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const lineRev = qty * price;
    const status = (item.status || "completed").toLowerCase();

    map[name].pricesSeen.add(price);

    if (status === "completed") {
      map[name].completedRevenue += lineRev;
      map[name].completedQuantity += qty;
      map[name].completedOrders += 1;
    } else if (status === "cancelled") {
      map[name].cancelledRevenue += lineRev;
      map[name].cancelledOrders += 1;
    }
  });

  const products = Object.values(map).map((p) => {
    const avgPrice =
      p.completedQuantity > 0
        ? Math.round((p.completedRevenue / p.completedQuantity) * 100) / 100
        : p.pricesSeen.size > 0
        ? Array.from(p.pricesSeen)[0]
        : 0;

    return {
      product: p.product,
      completedRevenue: p.completedRevenue,
      cancelledRevenue: p.cancelledRevenue,
      completedQuantity: p.completedQuantity,
      completedOrders: p.completedOrders,
      cancelledOrders: p.cancelledOrders,
      averageUnitPrice: avgPrice,
      distinctPrices: Array.from(p.pricesSeen),
      hasPriceFluctuation: p.pricesSeen.size > 1,
    };
  });

  // Sort descending by completed revenue
  products.sort((a, b) => b.completedRevenue - a.completedRevenue);

  const topRevenueProduct = products.length > 0 ? products[0] : null;
  const topVolumeProduct = [...products].sort((a, b) => b.completedQuantity - a.completedQuantity)[0] || null;

  return {
    products,
    productCount: products.length,
    topRevenueProduct,
    topVolumeProduct,
  };
}

/**
 * Compares product performance across two distinct periods to identify drivers of change
 */
export function analyzeProductPeriodChange(prevSales, currSales, totalRevenueDelta = null) {
  const prevAnalysis = analyzeProductPerformance(prevSales);
  const currAnalysis = analyzeProductPerformance(currSales);

  const prevMap = new Map(prevAnalysis.products.map((p) => [p.product, p]));
  const currMap = new Map(currAnalysis.products.map((p) => [p.product, p]));

  const allProductNames = Array.from(new Set([...prevMap.keys(), ...currMap.keys()]));

  const calculatedTotalDelta =
    totalRevenueDelta !== null
      ? totalRevenueDelta
      : currAnalysis.products.reduce((acc, p) => acc + p.completedRevenue, 0) -
        prevAnalysis.products.reduce((acc, p) => acc + p.completedRevenue, 0);

  const productComparisons = allProductNames.map((name) => {
    const prev = prevMap.get(name) || {
      product: name,
      completedRevenue: 0,
      completedQuantity: 0,
      completedOrders: 0,
      averageUnitPrice: 0,
      distinctPrices: [],
    };
    const curr = currMap.get(name) || {
      product: name,
      completedRevenue: 0,
      completedQuantity: 0,
      completedOrders: 0,
      averageUnitPrice: 0,
      distinctPrices: [],
    };

    const revenueDelta = curr.completedRevenue - prev.completedRevenue;
    const revenuePercentChange =
      prev.completedRevenue > 0
        ? Number(((revenueDelta / prev.completedRevenue) * 100).toFixed(2))
        : curr.completedRevenue > 0
        ? 100
        : 0;

    const quantityDelta = curr.completedQuantity - prev.completedQuantity;
    const quantityPercentChange =
      prev.completedQuantity > 0
        ? Number(((quantityDelta / prev.completedQuantity) * 100).toFixed(2))
        : curr.completedQuantity > 0
        ? 100
        : 0;

    const priceDelta = curr.averageUnitPrice - prev.averageUnitPrice;

    // Contribution to total revenue change
    let contributionPercent = 0;
    if (calculatedTotalDelta !== 0) {
      contributionPercent = Number(((revenueDelta / Math.abs(calculatedTotalDelta)) * 100).toFixed(2));
    }

    return {
      product: name,
      previousRevenue: prev.completedRevenue,
      currentRevenue: curr.completedRevenue,
      revenueDelta,
      revenuePercentChange,
      previousQuantity: prev.completedQuantity,
      currentQuantity: curr.completedQuantity,
      quantityDelta,
      quantityPercentChange,
      previousAvgPrice: prev.averageUnitPrice,
      currentAvgPrice: curr.averageUnitPrice,
      priceDelta,
      contributionPercent, // positive if moving in same direction as total delta
      trend: revenueDelta > 0 ? "growth" : revenueDelta < 0 ? "decline" : "stable",
    };
  });

  // Sort by largest absolute revenue drop first (decliners), then gainers
  const decliners = productComparisons
    .filter((p) => p.revenueDelta < 0)
    .sort((a, b) => a.revenueDelta - b.revenueDelta);

  const gainers = productComparisons
    .filter((p) => p.revenueDelta > 0)
    .sort((a, b) => b.revenueDelta - a.revenueDelta);

  const newProducts = productComparisons.filter(
    (p) => p.previousRevenue === 0 && p.currentRevenue > 0
  );

  const droppedProducts = productComparisons.filter(
    (p) => p.previousRevenue > 0 && p.currentRevenue === 0
  );

  return {
    totalRevenueDelta: calculatedTotalDelta,
    productComparisons,
    decliners,
    gainers,
    newProducts,
    droppedProducts,
    primaryDriverOfDecline: decliners.length > 0 ? decliners[0] : null,
    primaryDriverOfGrowth: gainers.length > 0 ? gainers[0] : null,
  };
}
