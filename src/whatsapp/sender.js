import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function checkedJson(response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(`WhatsApp API ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

export class WhatsAppCloudSender {
  constructor(config) {
    this.config = config;
  }

  async sendDocument({ recipient, filePath, caption }) {
    if (!this.config.enabled) throw new Error('WhatsApp provider is disabled');
    if (!this.config.phoneNumberId || !this.config.accessToken) throw new Error('WhatsApp Cloud API configuration is incomplete');
    const base = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}`;
    const bytes = await readFile(filePath);
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('type', 'application/pdf');
    form.set('file', new Blob([bytes], { type: 'application/pdf' }), path.basename(filePath));
    const upload = await checkedJson(await fetch(`${base}/media`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.config.accessToken}` }, body: form
    }));
    const message = await checkedJson(await fetch(`${base}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient.replace(/^\+/, ''),
        type: 'document',
        document: { id: upload.id, caption, filename: path.basename(filePath) }
      })
    }));
    return { mediaId: upload.id, messageId: message.messages?.[0]?.id || null, raw: message };
  }
}
