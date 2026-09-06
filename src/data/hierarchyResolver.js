import { isBlank, normalizeKey, normalizeText, toId } from '../utils/text.js';

const SOURCE = { PERSON: 'SR', TRS: 'T.S.O.', TSM: 'RSM', ASM: 'A.S.M.' };

function entity(row, nameIndex, idIndex) {
  const name = normalizeText(row.cells[nameIndex]);
  return { id: toId(row.cells[idIndex]), name, key: normalizeKey(name), sourceRow: row.rowNumber };
}

export function resolveHierarchy(parsed, { conflictStrategy = 'summary_wins' } = {}) {
  const { rows, columns } = parsed;
  const diagnostics = [];
  const tsmByKey = new Map();
  const trsByKey = new Map();
  const asmByTsmKey = new Map();
  const separatorByTrsKey = new Map();
  let pendingTsms = [];

  for (const row of rows) {
    if (row.designation === SOURCE.TSM) {
      const tsm = entity(row, columns.rsm, columns.id);
      if (!tsm.name) {
        diagnostics.push({ code: 'ORPHAN_TSM_SUMMARY', severity: 'error', row: row.rowNumber });
        continue;
      }
      tsmByKey.set(tsm.key, tsm);
      pendingTsms.push(tsm);
    } else if (row.designation === SOURCE.ASM) {
      const asm = entity(row, columns.rsm, columns.id);
      if (!asm.name) {
        diagnostics.push({ code: 'ORPHAN_ASM_SUMMARY', severity: 'error', row: row.rowNumber });
        continue;
      }
      for (const tsm of pendingTsms) asmByTsmKey.set(tsm.key, asm);
      diagnostics.push({
        code: 'ASM_MAPPING_INFERRED_FROM_BLOCK_ORDER',
        severity: 'warn',
        row: row.rowNumber,
        asm: asm.name,
        tsmCount: pendingTsms.length
      });
      pendingTsms = [];
    }
  }
  if (pendingTsms.length) {
    diagnostics.push({ code: 'TSM_WITHOUT_ASM_BLOCK', severity: 'error', tsms: pendingTsms.map((item) => item.name) });
  }

  for (const row of rows.filter((item) => item.designation === SOURCE.TRS)) {
    const tsmName = normalizeText(row.cells[columns.rsm]);
    const trs = entity(row, columns.tso, columns.id);
    if (!tsmName || !trs.name) {
      diagnostics.push({ code: 'ORPHAN_TRS_SUMMARY', severity: 'error', row: row.rowNumber, tsmName, trsName: trs.name });
      continue;
    }
    trsByKey.set(trs.key, { ...trs, tsmKey: normalizeKey(tsmName), tsmName });
  }

  const knownTrsKeys = new Set([
    ...trsByKey.keys(),
    ...rows.filter((row) => row.designation === SOURCE.PERSON).map((row) => normalizeKey(row.cells[columns.tso]))
  ]);
  for (const row of rows.filter((item) => !item.designation)) {
    const tsmName = normalizeText(row.cells[columns.rsm]);
    const trsName = normalizeText(row.cells[columns.tso]);
    const territory = normalizeText(row.cells[columns.areaPoint]);
    const trsKey = normalizeKey(trsName);
    if (!tsmName || !trsName || !territory || !knownTrsKeys.has(trsKey)) continue;
    separatorByTrsKey.set(trsKey, { row: row.rowNumber, tsmName, tsmKey: normalizeKey(tsmName), territory });
  }

  for (const [trsKey, trs] of trsByKey) {
    const separator = separatorByTrsKey.get(trsKey);
    if (!separator || separator.tsmKey === trs.tsmKey) continue;
    const conflict = {
      code: 'CONFLICTING_TRS_TSM_MAPPING',
      severity: 'error',
      trs: trs.name,
      summaryTsm: trs.tsmName,
      separatorTsm: separator.tsmName,
      summaryRow: trs.sourceRow,
      separatorRow: separator.row,
      strategy: conflictStrategy
    };
    diagnostics.push(conflict);
    if (conflictStrategy === 'separator_wins') {
      trs.tsmName = separator.tsmName;
      trs.tsmKey = separator.tsmKey;
    } else if (conflictStrategy === 'error') {
      throw new Error(`Hierarchy conflict for TRS ${trs.name}: ${trs.tsmName} vs ${separator.tsmName}`);
    }
  }

  return { sourceDesignations: SOURCE, tsmByKey, trsByKey, asmByTsmKey, separatorByTrsKey, diagnostics };
}
