import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const DELIVERY_STATUS = Object.freeze({
  GENERATED: 'GENERATED', DRY_RUN: 'DRY_RUN', QUEUED: 'QUEUED', SENT: 'SENT',
  FAILED: 'FAILED', SKIPPED: 'SKIPPED'
});

export class DeliveryStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async read() {
    try { return JSON.parse(await readFile(this.filePath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { version: 1, reports: {} }; throw error; }
  }

  async get(reportId) {
    return (await this.read()).reports[reportId] || null;
  }

  async set(reportId, status, details = {}) {
    this.queue = this.queue.then(async () => {
      const state = await this.read();
      const previous = state.reports[reportId] || {};
      const event = { status, timestamp: new Date().toISOString(), ...details };
      state.reports[reportId] = {
        ...previous,
        ...details,
        reportId,
        status,
        everSent: previous.everSent || status === DELIVERY_STATUS.SENT,
        sentAt: status === DELIVERY_STATUS.SENT ? event.timestamp : previous.sentAt,
        history: [...(previous.history || []), event].slice(-50),
        updatedAt: event.timestamp
      };
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
      await rename(temporary, this.filePath);
      return state.reports[reportId];
    });
    return this.queue;
  }
}
