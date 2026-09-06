import { isBlank, normalizeKey, normalizeText, toId, toNumber } from '../utils/text.js';

export function normalizeSource(parsed, hierarchy) {
  const { columns, monthlyWorkingDays, month } = parsed;
  const diagnostics = [...parsed.diagnostics, ...hierarchy.diagnostics];
  const records = [];
  const seenIds = new Map();
  const nameToIds = new Map();
  const dealerNamesById = new Map();

  for (const row of parsed.rows.filter((item) => item.designation === hierarchy.sourceDesignations.PERSON)) {
    const personName = normalizeText(row.cells[columns.person]);
    const sourceTsmName = normalizeText(row.cells[columns.rsm]);
    const sourceTrsName = normalizeText(row.cells[columns.tso]);
    const personId = toId(row.cells[columns.id] ?? row.cells[columns.pfNumber]);
    const trs = hierarchy.trsByKey.get(normalizeKey(sourceTrsName));
    const tsmName = trs?.tsmName || sourceTsmName;
    const tsmKey = normalizeKey(tsmName);
    const tsm = hierarchy.tsmByKey.get(tsmKey) || { id: null, name: tsmName, key: tsmKey };
    const asm = hierarchy.asmByTsmKey.get(tsmKey) || null;
    const separator = hierarchy.separatorByTrsKey.get(normalizeKey(sourceTrsName));

    if (!personName || !sourceTrsName || !tsmName || !asm) {
      diagnostics.push({
        code: 'ORPHAN_PERSON_HIERARCHY', severity: 'error', row: row.rowNumber,
        personName, trsName: sourceTrsName, tsmName, hasAsm: Boolean(asm)
      });
    }
    if (!trs) diagnostics.push({ code: 'MISSING_TRS_SUMMARY', severity: 'error', row: row.rowNumber, trsName: sourceTrsName, personName });
    if (!personId) diagnostics.push({ code: 'MISSING_PERSON_ID', severity: 'warn', row: row.rowNumber, personName });
    if (personId && seenIds.has(personId)) {
      diagnostics.push({ code: 'DUPLICATE_PERSON_ID', severity: 'error', id: personId, rows: [seenIds.get(personId), row.rowNumber] });
    } else if (personId) seenIds.set(personId, row.rowNumber);

    const nameKey = normalizeKey(personName);
    if (!nameToIds.has(nameKey)) nameToIds.set(nameKey, new Set());
    if (personId) nameToIds.get(nameKey).add(personId);

    const sales = toNumber(row.cells[columns.sales]);
    const target = toNumber(row.cells[columns.target]);
    const orders = toNumber(row.cells[columns.orders]);
    const currentWorkingDays = toNumber(row.cells[columns.currentWorkingDays]);
    const dealerId = toId(row.cells[columns.dealerId]);
    const dealerName = normalizeText(row.cells[columns.areaPoint]) || null;
    const joiningDate = columns.joiningDate >= 0 ? row.cells[columns.joiningDate] : null;
    if (target === null) diagnostics.push({ code: 'MISSING_TARGET', severity: 'warn', row: row.rowNumber, personName });
    if (sales === null) diagnostics.push({ code: 'INVALID_OR_MISSING_SALES', severity: 'warn', row: row.rowNumber, personName });
    else if (sales === 0) diagnostics.push({ code: 'ZERO_SALES', severity: 'info', row: row.rowNumber, personName });
    else if (sales < 0) diagnostics.push({ code: 'NEGATIVE_SALES', severity: 'error', row: row.rowNumber, personName, sales });
    if (target !== null && target < 0) diagnostics.push({ code: 'NEGATIVE_TARGET', severity: 'error', row: row.rowNumber, personName, target });
    if (orders !== null && orders < 0) diagnostics.push({ code: 'NEGATIVE_ORDERS', severity: 'error', row: row.rowNumber, personName, orders });
    if (currentWorkingDays !== null && currentWorkingDays < 0) diagnostics.push({ code: 'NEGATIVE_WORKING_DAYS', severity: 'error', row: row.rowNumber, personName, currentWorkingDays });
    if (!currentWorkingDays) diagnostics.push({ code: 'ZERO_WORKING_DAYS', severity: 'info', row: row.rowNumber, personName });
    if (!orders) diagnostics.push({ code: 'ZERO_ORDERS', severity: 'info', row: row.rowNumber, personName });
    if (!isBlank(joiningDate) && !(typeof joiningDate === 'number' && Number.isFinite(joiningDate)) && Number.isNaN(Date.parse(joiningDate))) {
      diagnostics.push({ code: 'INVALID_JOINING_DATE', severity: 'warn', row: row.rowNumber, personName, value: joiningDate });
    }
    if (dealerId && dealerName) {
      const knownName = dealerNamesById.get(dealerId);
      if (knownName && normalizeKey(knownName) !== normalizeKey(dealerName)) {
        diagnostics.push({ code: 'CONFLICTING_DEALER_ID', severity: 'warn', row: row.rowNumber, dealerId, knownName, conflictingName: dealerName });
      } else if (!knownName) dealerNamesById.set(dealerId, dealerName);
    }

    records.push({
      sourceRow: row.rowNumber,
      month,
      monthlyWorkingDays,
      asm: asm ? { id: asm.id, name: asm.name, key: asm.key } : null,
      tsm: { id: tsm.id, name: tsm.name, key: tsm.key },
      trs: { id: trs?.id || null, name: sourceTrsName, key: normalizeKey(sourceTrsName) },
      person: { id: personId, name: personName, key: personId || `${normalizeKey(personName)}-row-${row.rowNumber}` },
      territory: separator?.territory || null,
      dealer: { id: dealerId, name: dealerName },
      operation: normalizeText(row.cells[columns.operation]) || null,
      target,
      sales,
      orders,
      currentWorkingDays,
      joiningDate: isBlank(joiningDate) ? null : joiningDate,
      source: { designation: row.designation }
    });
  }

  for (const [nameKey, ids] of nameToIds) {
    if (ids.size > 1) diagnostics.push({ code: 'DUPLICATE_PERSON_NAME', severity: 'warn', nameKey, ids: [...ids] });
  }
  for (const row of parsed.rows) {
    if (row.designation && !Object.values(hierarchy.sourceDesignations).includes(row.designation)) {
      diagnostics.push({ code: 'UNEXPECTED_SUMMARY_ROW', severity: 'warn', row: row.rowNumber, designation: row.designation });
    }
  }
  return { records, diagnostics, month, monthlyWorkingDays, sourceRowCount: parsed.sourceRowCount };
}
