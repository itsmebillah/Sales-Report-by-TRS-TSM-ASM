import { isBlank, normalizeHeader, normalizeText, toNumber } from '../utils/text.js';

const REQUIRED_HEADERS = ['id', 'rsm', 'tso', 'designation'];

function findHeaderRow(values) {
  for (let index = 0; index < Math.min(values.length, 20); index += 1) {
    const normalized = new Set((values[index] || []).map(normalizeHeader));
    if (REQUIRED_HEADERS.every((header) => normalized.has(header))) return index;
  }
  throw new Error(`Could not find header row containing: ${REQUIRED_HEADERS.join(', ')}`);
}

function resolveColumns(headers) {
  const normalized = headers.map(normalizeHeader);
  const exact = (name) => normalized.indexOf(name);
  const contains = (fragment) => normalized.findIndex((value) => value.includes(fragment));
  const columns = {
    id: exact('id'),
    rsm: exact('rsm'),
    tso: exact('tso'),
    person: exact('sr'),
    operation: exact('op'),
    designation: exact('designation'),
    pfNumber: exact('pf no'),
    dealerId: exact('dealer sl'),
    areaPoint: exact('area point'),
    sales: normalized.findIndex((value) => value.startsWith('sales of ')),
    target: contains('monthly tgt product wise value'),
    orders: exact('no of order'),
    currentWorkingDays: exact('current wd'),
    projectedSales: contains('month end exp delivery'),
    dailyAverageMemo: exact('sr daily avg memo'),
    averageMemoPerHour: exact('avg memo hr'),
    averageWorkingHour: exact('sr avg working hour'),
    joiningDate: exact('joining date')
  };
  const requiredColumns = new Set([
    'id', 'rsm', 'tso', 'person', 'designation', 'dealerId', 'areaPoint',
    'sales', 'target', 'orders', 'currentWorkingDays'
  ]);
  const missing = Object.entries(columns)
    .filter(([key, index]) => requiredColumns.has(key) && index < 0)
    .map(([key]) => key);
  if (missing.length) throw new Error(`Missing required source columns: ${missing.join(', ')}`);
  columns.dailySales = normalized
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => /^([1-9]|[12]\d|3[01])$/.test(value));
  return columns;
}

function readMonthlyWorkingDays(values, headerRowIndex) {
  for (let row = 0; row < headerRowIndex; row += 1) {
    for (let column = 0; column < (values[row] || []).length; column += 1) {
      if (normalizeHeader(values[row][column]) === 'monthly wd') {
        const candidate = toNumber(values[row][column + 1]);
        if (candidate !== null) return candidate;
      }
    }
  }
  return null;
}

function monthFromLabel(value) {
  const text = normalizeText(value);
  const match = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s*'?(\d{2,4})$/i);
  if (!match) return null;
  const month = new Date(`${match[1]} 1, 2000`).getMonth() + 1;
  const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function reportMonth(values, headers, columns, override) {
  if (override) return override;
  for (const row of values.slice(0, 4)) {
    for (const cell of row || []) {
      const parsed = monthFromLabel(cell);
      if (parsed) return parsed;
    }
  }
  const salesHeader = headers[columns.sales];
  const embedded = normalizeText(salesHeader).replace(/^sales of\s+/i, '');
  return monthFromLabel(embedded) || null;
}

export function parseSheetValues(values, options = {}) {
  const headerRowIndex = findHeaderRow(values);
  const headers = values[headerRowIndex] || [];
  const columns = resolveColumns(headers);
  const diagnostics = [];
  const rows = values.slice(headerRowIndex + 1).map((cells, offset) => ({
    rowNumber: headerRowIndex + offset + 2,
    cells,
    designation: normalizeText(cells?.[columns.designation])
  }));
  const monthlyWorkingDays = options.monthlyWorkingDays || readMonthlyWorkingDays(values, headerRowIndex);
  const month = reportMonth(values, headers, columns, options.month);
  if (!monthlyWorkingDays) diagnostics.push({ code: 'MISSING_MONTHLY_WORKING_DAYS', severity: 'error' });
  if (!month) diagnostics.push({ code: 'MISSING_REPORT_MONTH', severity: 'error' });
  if (columns.dailySales.some(({ value }) => value === '31') && month) {
    const [year, monthNumber] = month.split('-').map(Number);
    const days = new Date(year, monthNumber, 0).getDate();
    if (days < 31) diagnostics.push({ code: 'INVALID_DAY_COLUMN_FOR_MONTH', severity: 'warn', day: 31, month });
  }
  const nonemptyRows = rows.filter(({ cells }) => cells.some((value) => !isBlank(value))).length;
  return {
    headerRowNumber: headerRowIndex + 1,
    headers,
    columns,
    rows,
    month,
    monthlyWorkingDays,
    diagnostics,
    sourceRowCount: values.length,
    nonemptyRows
  };
}
