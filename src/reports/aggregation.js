import { calculatePerformance } from './calculations.js';

export function aggregateRecordSet(records, { strictTargetCoverage = true } = {}) {
  const numericSales = records.map((item) => item.sales).filter(Number.isFinite);
  const numericTargets = records.map((item) => item.target).filter(Number.isFinite);
  const numericOrders = records.map((item) => item.orders).filter(Number.isFinite);
  const workingDays = records.map((item) => item.currentWorkingDays).filter(Number.isFinite);
  const monthlyDays = records.map((item) => item.monthlyWorkingDays).filter(Number.isFinite);
  const missingTargetCount = records.length - numericTargets.length;
  const invalidSalesCount = records.length - numericSales.length;
  const targetComplete = !strictTargetCoverage || missingTargetCount === 0;
  const rawTarget = numericTargets.length ? numericTargets.reduce((sum, value) => sum + value, 0) : null;
  const sales = numericSales.length ? numericSales.reduce((sum, value) => sum + value, 0) : null;
  const orders = numericOrders.length ? numericOrders.reduce((sum, value) => sum + value, 0) : null;
  const passedWorkingDays = workingDays.length ? Math.max(...workingDays) : null;
  const monthlyWorkingDays = monthlyDays.length ? Math.max(...monthlyDays) : null;
  return {
    ...calculatePerformance({
      target: targetComplete ? rawTarget : null,
      sales,
      orders,
      passedWorkingDays,
      monthlyWorkingDays,
      targetComplete
    }),
    knownTarget: rawTarget,
    targetComplete,
    missingTargetCount,
    invalidSalesCount,
    sourceRowCount: records.length
  };
}

function group(records, keyFn) {
  const groups = new Map();
  for (const record of records) {
    const key = keyFn(record);
    if (!key || key.includes('missing')) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return groups;
}

export function buildAggregates(records, options = {}) {
  const trsGroups = group(records, (r) => r.trs?.key && `${r.asm?.key || 'missing'}|${r.tsm?.key || 'missing'}|${r.trs.key}`);
  const tsmGroups = group(records, (r) => r.tsm?.key && `${r.asm?.key || 'missing'}|${r.tsm.key}`);
  const asmGroups = group(records, (r) => r.asm?.key);
  const make = (groups, level) => [...groups.entries()].map(([key, members]) => {
    const first = members[0];
    return {
      key,
      level,
      entity: first[level],
      asm: first.asm,
      tsm: first.tsm,
      trs: first.trs,
      records: members,
      metrics: aggregateRecordSet(members, options)
    };
  });
  return { trs: make(trsGroups, 'trs'), tsm: make(tsmGroups, 'tsm'), asm: make(asmGroups, 'asm') };
}
