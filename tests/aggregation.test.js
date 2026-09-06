import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRecordSet } from '../src/reports/aggregation.js';

const base = { monthlyWorkingDays: 26 };

test('aggregate totals use sums and maximum calendar working days', () => {
  const result = aggregateRecordSet([
    { ...base, target: 100, sales: 50, orders: 5, currentWorkingDays: 5 },
    { ...base, target: 300, sales: 150, orders: 15, currentWorkingDays: 6 }
  ]);
  assert.equal(result.target, 400);
  assert.equal(result.sales, 200);
  assert.equal(result.orders, 20);
  assert.equal(result.passedWorkingDays, 6);
  assert.equal(result.achievementPercent, 50);
});

test('strict target coverage suppresses partial-denominator percentages', () => {
  const records = [
    { ...base, target: 100, sales: 50, orders: 5, currentWorkingDays: 5 },
    { ...base, target: null, sales: 25, orders: 2, currentWorkingDays: 5 }
  ];
  const strict = aggregateRecordSet(records, { strictTargetCoverage: true });
  assert.equal(strict.knownTarget, 100);
  assert.equal(strict.target, null);
  assert.equal(strict.achievementPercent, null);
  const permissive = aggregateRecordSet(records, { strictTargetCoverage: false });
  assert.equal(permissive.target, 100);
  assert.equal(permissive.achievementPercent, 75);
});
