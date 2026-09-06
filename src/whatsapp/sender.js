import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

function serializedId(message) {
  return message?.id?._serialized || message?.id?.id || null;
}

function normalizeRecipient(recipient) {
  const digits = String(recipient || '').replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('Recipient must be a valid international phone number');
  return digits;
}

function firstExisting(paths) {
  return paths.find((candidate) => candidate && existsSync(candidate)) || '';
}

function defaultBrowserPath(configuredPath) {
  if (configuredPath) {
    if (!existsSync(configuredPath)) throw new Error('WHATSAPP_BROWSER_PATH does not exist');
    return configuredPath;
  }
  const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env.LOCALAPPDATA || '';
  const windowsPaths = [
    path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    localAppData && path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ];
  const unixPaths = [
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/brave-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  const resolved = firstExisting(process.platform === 'win32' ? windowsPaths : unixPaths);
  if (!resolved) throw new Error('No supported Chromium browser found; set WHATSAPP_BROWSER_PATH');
  return resolved;
}

export class WhatsAppWebSender {
  constructor(config, { clientFactory, localAuthFactory, mediaFactory, qrRenderer, browserPathResolver } = {}) {
    this.config = config;
    this.clientFactory = clientFactory || ((options) => new Client(options));
    this.localAuthFactory = localAuthFactory || ((options) => new LocalAuth(options));
    this.mediaFactory = mediaFactory || MessageMedia;
    this.qrRenderer = qrRenderer || ((code) => qrcode.generate(code, { small: true }));
    this.browserPathResolver = browserPathResolver || defaultBrowserPath;
    this.client = null;
    this.ready = false;
    this.connecting = null;
  }

  async connect() {
    if (this.ready) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.initializeClient();
    try { await this.connecting; }
    finally { this.connecting = null; }
  }

  async initializeClient() {
    if (!this.config.enabled) throw new Error('WhatsApp provider is disabled');
    const executablePath = this.browserPathResolver(this.config.browserPath);
    const puppeteer = {
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    };
    puppeteer.executablePath = executablePath;
    this.client = this.clientFactory({
      authStrategy: this.localAuthFactory({ clientId: this.config.sessionName, dataPath: this.config.sessionDir }),
      puppeteer
    });

    const ready = new Promise((resolve, reject) => {
      this.client.once('ready', () => { this.ready = true; resolve(); });
      this.client.once('auth_failure', (message) => reject(new Error(`WhatsApp authentication failed: ${message}`)));
      this.client.once('disconnected', (reason) => {
        this.ready = false;
        reject(new Error(`WhatsApp disconnected before ready: ${reason}`));
      });
      this.client.on('qr', this.qrRenderer);
    });
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('WhatsApp Web connection timed out')), this.config.connectTimeoutMs).unref?.();
    });
    await Promise.race([ready, timeout, this.client.initialize()]);
    if (!this.ready) await Promise.race([ready, timeout]);
  }

  async resolveRecipient(recipient) {
    const digits = normalizeRecipient(recipient);
    const numberId = await this.client.getNumberId(digits);
    if (!numberId) return { valid: false, digits, jid: null };
    return { valid: true, digits, jid: `${digits}@c.us`, resolvedJid: numberId._serialized || null };
  }

  async sendPayload({ recipient, content, options = {} }) {
    await this.connect();
    const resolved = await this.resolveRecipient(recipient);
    if (!resolved.valid) {
      return { success: false, outcome: 'DEFINITE_FAILURE', error: 'recipient_not_registered', messageId: null };
    }

    const ackById = new Map();
    const ackListener = (message, ack) => {
      const id = serializedId(message);
      if (id) ackById.set(id, ack);
    };
    this.client.on('message_ack', ackListener);
    let dispatchStarted = false;
    try {
      dispatchStarted = true;
      const sent = await this.client.sendMessage(resolved.jid, content, options);
      const messageId = serializedId(sent);
      let ack = Number(sent?.ack ?? (messageId ? ackById.get(messageId) : 0)) || 0;
      const deadline = Date.now() + this.config.ackTimeoutMs;
      while (ack < 1 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(250, Math.max(deadline - Date.now(), 1))));
        ack = Math.max(ack, Number(messageId ? ackById.get(messageId) : 0) || 0);
      }
      if (ack < 1) {
        return { success: false, outcome: 'CONFIRMATION_PENDING', error: 'dispatch_completed_without_server_ack', messageId, ack };
      }
      return { success: true, outcome: 'CONFIRMED', messageId, ack };
    } catch (error) {
      return {
        success: false,
        outcome: dispatchStarted ? 'CONFIRMATION_PENDING' : 'DEFINITE_FAILURE',
        error: error.message,
        messageId: null,
        ack: 0
      };
    } finally {
      this.client.off('message_ack', ackListener);
    }
  }

  async sendText({ recipient, text }) {
    if (!text) throw new Error('Text message is required');
    return this.sendPayload({ recipient, content: text });
  }

  async sendDocument({ recipient, filePath, caption }) {
    const media = this.mediaFactory.fromFilePath(filePath);
    return this.sendPayload({
      recipient,
      content: media,
      options: { caption, sendMediaAsDocument: true }
    });
  }

  async disconnect() {
    if (!this.client) return;
    try { await this.client.destroy(); }
    finally { this.client = null; this.ready = false; }
  }
}
