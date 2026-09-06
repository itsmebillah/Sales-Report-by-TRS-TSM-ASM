const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(value) {
  return value === null || value === undefined ? 'N/A' : numberFormatter.format(value);
}

export function formatDecimal(value) {
  return value === null || value === undefined ? 'N/A' : decimalFormatter.format(value);
}

export function formatPercent(value) {
  return value === null || value === undefined ? 'N/A' : `${decimalFormatter.format(value)}%`;
}
