import { formatDecimal, formatMoney, formatPercent } from '../../utils/format.js';

const COLORS = {
  navy: '#15324B', blue: '#176B87', teal: '#2A9D8F', pale: '#EAF4F4',
  gold: '#E9C46A', text: '#263238', muted: '#607D8B', border: '#D7E0E5', white: '#FFFFFF'
};

const columns = [
  ['Name', 144, (row) => row.entity.name],
  ['Target', 70, (row) => formatMoney(row.metrics.target)],
  ['Sales', 70, (row) => formatMoney(row.metrics.sales)],
  ['Ach. %', 50, (row) => formatPercent(row.metrics.achievementPercent)],
  ['Daily Avg.', 72, (row) => formatMoney(row.metrics.dailyAverageSales)],
  ['Req. Daily', 72, (row) => formatMoney(row.metrics.requiredDailySales)],
  ['Projection', 78, (row) => formatMoney(row.metrics.projection)],
  ['Proj. %', 52, (row) => formatPercent(row.metrics.projectionPercent)],
  ['Avg. Memo', 58, (row) => formatDecimal(row.metrics.dailyAverageMemo)],
  ['Memo Value', 70, (row) => formatMoney(row.metrics.averageMemoValue)],
  ['WD', 42, (row) => formatDecimal(row.metrics.passedWorkingDays)]
];

function card(doc, x, y, width, label, value, accent) {
  doc.roundedRect(x, y, width, 48, 5).fill(COLORS.white).strokeColor(COLORS.border).stroke();
  doc.rect(x, y, 5, 48).fill(accent);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5).text(label.toUpperCase(), x + 14, y + 9, { width: width - 20 });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(15).text(value, x + 14, y + 23, { width: width - 20 });
}

function tableHeader(doc, x, y) {
  let cursor = x;
  doc.rect(x, y, columns.reduce((sum, [, width]) => sum + width, 0), 25).fill(COLORS.navy);
  for (const [label, width] of columns) {
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(6.8)
      .text(label, cursor + 3, y + 8, { width: width - 6, align: label === 'Name' ? 'left' : 'right' });
    cursor += width;
  }
  return y + 25;
}

function tableRow(doc, x, y, row, shade = false, total = false) {
  const height = 25;
  let cursor = x;
  doc.rect(x, y, 778, height).fill(total ? COLORS.pale : shade ? '#F7FAFB' : COLORS.white);
  for (const [label, width, getter] of columns) {
    doc.rect(cursor, y, width, height).strokeColor(COLORS.border).lineWidth(0.4).stroke();
    doc.fillColor(total ? COLORS.navy : COLORS.text).font(total ? 'Helvetica-Bold' : 'Helvetica').fontSize(7)
      .text(getter(row), cursor + 3, y + 8, { width: width - 6, height: 12, ellipsis: true, align: label === 'Name' ? 'left' : 'right' });
    cursor += width;
  }
  return y + height;
}

function addPage(doc, report) {
  doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 30, bottom: 34, left: 32, right: 32 } });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(16).text(`${report.type.toUpperCase()} Monthly Performance Report`, 32, 28);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(`${report.entity.name} | ${report.month}`, 32, 48);
  return tableHeader(doc, 32, 69);
}

export function drawMonthlyPerformanceReport(doc, report) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F4F7F9');
  doc.rect(0, 0, doc.page.width, 78).fill(COLORS.navy);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(21)
    .text(`${report.type.toUpperCase()} MONTHLY PERFORMANCE REPORT`, 32, 25);
  const subtitle = [report.entity.name, report.parent?.name, report.month].filter(Boolean).join('  |  ');
  doc.fillColor('#DCE8EE').font('Helvetica').fontSize(9).text(subtitle, 32, 52);

  const cards = [
    ['Monthly Target', formatMoney(report.total.target), COLORS.blue],
    ['Sales Achieved', formatMoney(report.total.sales), COLORS.teal],
    ['Achievement', formatPercent(report.total.achievementPercent), COLORS.gold],
    ['Projection', formatPercent(report.total.projectionPercent), '#E76F51']
  ];
  cards.forEach(([label, value, accent], index) => card(doc, 32 + index * 197, 94, 187, label, value, accent));

  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
    .text(`Performance detail (${report.sourceRowCount} underlying record${report.sourceRowCount === 1 ? '' : 's'})`, 32, 158);
  let y = tableHeader(doc, 32, 175);
  report.rows.forEach((row, index) => {
    if (y + 25 > doc.page.height - 52) y = addPage(doc, report);
    y = tableRow(doc, 32, y, row, index % 2 === 1);
  });
  if (y + 25 > doc.page.height - 52) y = addPage(doc, report);
  y = tableRow(doc, 32, y, { entity: { name: 'TOTAL' }, metrics: report.total }, false, true);

  const notes = [
    'Method: Daily Avg. Sales = Sales / Passed WD; Required Daily = remaining target / remaining WD.',
    'Projection = Daily Avg. Sales x Monthly WD. Percentages use aggregate sales and target; percentages are not averaged.',
    report.total.targetComplete ? 'Target coverage: complete for included records.' : `Target coverage incomplete: ${report.total.missingTargetCount} underlying record(s) have no target; target percentages are shown as N/A.`
  ];
  if (y + 55 > doc.page.height - 34) {
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 30, bottom: 34, left: 32, right: 32 } });
    y = 35;
  } else y += 12;
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5).text(notes.join('\n'), 32, y, { width: 778, lineGap: 2 });
}

export function addFooters(doc, reportId) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7)
      .text(`Report ID: ${reportId}`, 32, doc.page.height - 24, { width: 500 })
      .text(`Page ${index - range.start + 1} of ${range.count}`, doc.page.width - 132, doc.page.height - 24, { width: 100, align: 'right' });
  }
}
