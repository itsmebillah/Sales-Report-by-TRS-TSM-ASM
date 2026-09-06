import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { addFooters, drawMonthlyPerformanceReport } from './templates/monthlyPerformance.js';

export async function renderReportPdf(report, filePath, { reportId } = {}) {
  await mkdir(path.dirname(filePath), { recursive: true });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 30, bottom: 34, left: 32, right: 32 }, bufferPages: true, info: {
      Title: `${report.type.toUpperCase()} Monthly Performance Report - ${report.entity.name}`,
      Subject: report.month,
      Creator: 'Sales Report by TRS, TSM & ASM'
    } });
    const stream = createWriteStream(filePath);
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
    doc.on('error', reject);
    doc.pipe(stream);
    drawMonthlyPerformanceReport(doc, report);
    addFooters(doc, reportId || 'unassigned');
    doc.end();
  });
}
