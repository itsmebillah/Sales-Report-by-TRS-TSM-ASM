export function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function normalizeHeader(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
}

export function isBlank(value) {
  return value === null || value === undefined || normalizeText(value) === '';
}

export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = normalizeText(value);
  if (!text || text === '-' || /^n\/?a$/i.test(text)) return null;
  const parsed = Number(text.replace(/,/g, '').replace(/%$/, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function toId(value) {
  if (isBlank(value)) return null;
  return normalizeText(value).replace(/,/g, '');
}

export function slugify(value, fallback = 'unknown') {
  return normalizeKey(value) || fallback;
}

export function quoteSheetName(name) {
  return `'${String(name).replaceAll("'", "''")}'`;
}
