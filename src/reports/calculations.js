export function safeDivide(numerator, denominator) {
  if (numerator === null || numerator === undefined || !Number.isFinite(numerator)) return null;
  if (denominator === null || denominator === undefined || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

export function calculatePerformance({
  target,
  sales,
  orders,
  passedWorkingDays,
  monthlyWorkingDays,
  targetComplete = target !== null && target !== undefined
}) {
  const safeSales = Number.isFinite(sales) ? sales : null;
  const safeTarget = targetComplete && Number.isFinite(target) ? target : null;
  const passed = Number.isFinite(passedWorkingDays) ? Math.max(passedWorkingDays, 0) : null;
  const monthly = Number.isFinite(monthlyWorkingDays) ? Math.max(monthlyWorkingDays, 0) : null;
  const remainingWorkingDays = passed === null || monthly === null ? null : Math.max(monthly - passed, 0);
  const remainingTarget = safeTarget === null || safeSales === null ? null : Math.max(safeTarget - safeSales, 0);
  const dailyAverageSales = safeDivide(safeSales, passed);
  const projection = dailyAverageSales === null || monthly === null ? null : dailyAverageSales * monthly;
  return {
    target: safeTarget,
    sales: safeSales,
    orders: Number.isFinite(orders) ? orders : null,
    passedWorkingDays: passed,
    monthlyWorkingDays: monthly,
    remainingWorkingDays,
    remainingTarget,
    achievementPercent: safeDivide(safeSales, safeTarget) === null ? null : safeDivide(safeSales, safeTarget) * 100,
    dailyAverageSales,
    requiredDailySales: safeDivide(remainingTarget, remainingWorkingDays),
    projection,
    projectionPercent: safeDivide(projection, safeTarget) === null ? null : safeDivide(projection, safeTarget) * 100,
    dailyAverageMemo: safeDivide(orders, passed),
    averageMemoValue: safeDivide(safeSales, orders)
  };
}
