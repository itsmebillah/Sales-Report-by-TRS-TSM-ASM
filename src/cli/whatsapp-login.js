import { loadConfig } from '../config/config.js';
import { WhatsAppWebSender } from '../whatsapp/sender.js';

const config = loadConfig();
if (!config.whatsapp.enabled) {
  process.stderr.write('Set WHATSAPP_ENABLED=true before running the WhatsApp login command.\n');
  process.exitCode = 1;
} else {
  const sender = new WhatsAppWebSender(config.whatsapp);
  try {
    process.stdout.write('Starting WhatsApp Web authentication. Scan the QR code if prompted. No message will be sent.\n');
    await sender.connect();
    process.stdout.write(`WhatsApp session '${config.whatsapp.sessionName}' is authenticated and ready. No message was sent.\n`);
  } catch (error) {
    process.stderr.write(`WhatsApp authentication failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await sender.disconnect().catch(() => {});
  }
}
