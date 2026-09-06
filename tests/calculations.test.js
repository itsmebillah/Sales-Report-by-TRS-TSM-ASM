import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePerformance, safeDivide } from '../src/reports/calculations.js';

test('calculates the reference performance formulas', () => {
  const result = calculatePerformance({ target: 260000, sales: 60000, orders: 30, passedWorkingDays: 6, monthlyWorkingDays: 26 });
  assert.equal(result.achievementPercent, 60000 / 260000 * 100);
  assert.equal(result.dailyAverageSales, 10000);
  assert.equal(result.remainingWorkingDays, 20);
  assert.equal(result.requiredDailySales, 10000);
  assert.equal(result.projection, 260000);
  assert.equal(result.projectionPercent, 100);
  assert.equal(result.dailyAverageMemo, 5);
  assert.equal(result.averageMemoValue, 2000);
});

test('zero working days, orders, and target are division-safe', () => {
  const result = calculatePerformance({ target: 0, sales: 0, orders: 0, passedWorkingDays: 0, monthlyWorkingDays: 26 });
  assert.equal(result.dailyAverageSales, null);
  assert.equal(result.dailyAverageMemo, null);
  assert.equal(result.averageMemoValue, null);
  assert.equal(result.achievementPercent, null);
  assert.equal(result.projectionPercent, null);
  assert.equal(safeDivide(1, 0), null);
});

test('missing target never fabricates target-derived metrics', () => {
  const result = calculatePerformance({ target: null, sales: 100, orders: 2, passedWorkingDays: 2, monthlyWorkingDays: 26, targetComplete: false });
  assert.equal(result.achievementPercent, null);
  assert.equal(result.requiredDailySales, null);
  assert.equal(result.projectionPercent, null);
  assert.equal(result.dailyAverageSales, 50);
});

test('remaining working days never becomes negative', () => {
  const result = calculatePerformance({ target: 100, sales: 50, orders: 1, passedWorkingDays: 30, monthlyWorkingDays: 26 });
  assert.equal(result.remainingWorkingDays, 0);
  assert.equal(result.requiredDailySales, null);
});
