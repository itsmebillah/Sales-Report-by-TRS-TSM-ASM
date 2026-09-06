import { calculatePerformance } from './calculations.js';
import { aggregateRecordSet, buildAggregates } from './aggregation.js';

function personRow(record) {
  return {
    entity: record.person,
    territory: record.territory,
    metrics: calculatePerformance({
      target: record.target,
      sales: record.sales,
      orders: record.orders,
      passedWorkingDays: record.currentWorkingDays,
      monthlyWorkingDays: record.monthlyWorkingDays,
      targetComplete: Number.isFinite(record.target)
    }),
    sourceRowCount: 1
  };
}

function report({ type, entity, parent, records, rows, options }) {
  return {
    type,
    entity,
    parent,
    month: records[0]?.month,
    monthlyWorkingDays: records[0]?.monthlyWorkingDays,
    sourceRowCount: records.length,
    rows,
    total: aggregateRecordSet(records, options)
  };
}

export function buildReports(records, options = {}) {
  const aggregates = buildAggregates(records, options);
  const trs = aggregates.trs.map((item) => report({
    type: 'trs', entity: item.entity, parent: item.tsm, records: item.records,
    rows: item.records.map(personRow), options
  }));
  const tsm = aggregates.tsm.map((item) => report({
    type: 'tsm', entity: item.entity, parent: item.asm, records: item.records,
    rows: aggregates.trs.filter((child) => child.tsm?.key === item.entity.key && child.asm?.key === item.asm?.key)
      .map((child) => ({ entity: child.entity, territory: child.records[0]?.territory, metrics: child.metrics, sourceRowCount: child.records.length })),
    options
  }));
  const asm = aggregates.asm.map((item) => report({
    type: 'asm', entity: item.entity, parent: null, records: item.records,
    rows: aggregates.tsm.filter((child) => child.asm?.key === item.entity.key)
      .map((child) => ({ entity: child.entity, territory: null, metrics: child.metrics, sourceRowCount: child.records.length })),
    options
  }));
  return { trs, tsm, asm, all: [...trs, ...tsm, ...asm], aggregates };
}
