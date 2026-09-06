# Sales Report by TRS, TSM & ASM

Production-oriented Node.js service for reading the monthly Google Sheet, resolving the current report-block hierarchy, calculating performance metrics, generating server-side PDFs, and delivering documents through a guarded WhatsApp provider.

| Report term | Current source representation |
| --- | --- |
| ASM | Rows whose `Designation` is `A.S.M.` |
| TSM | Rows whose `Designation` is `RSM` |
| TRS | Rows whose `Designation` is `T.S.O.` |
| Field-force person | Rows whose `Designation` is `SR` |

The service never writes to the source spreadsheet. A narrow Apps Script web bridge reads the one configured tab with the read-only Sheets scope and returns it to Node over HTTPS. Node does not require Google Application Default Credentials or a service-account JSON file.

## Setup

Use Node.js 22.12 or newer. This is required by the patched browser automation dependency.

```bash
npm install
copy .env.example .env
copy config\recipients.example.json config\recipients.json
```

Configure and deploy the controlled read-only bridge described in [docs/apps-script-bridge.md](docs/apps-script-bridge.md). Put its `/exec` URL and shared bridge token in the untracked `.env` file as `APPS_SCRIPT_BRIDGE_URL` and `APPS_SCRIPT_BRIDGE_TOKEN`. Recipient mappings remain in the ignored `config/recipients.json` file.

## Commands

```bash
npm test
npm run lint
npm run report:sample
npm run report:dry-run
npm run whatsapp:login
npm start
```

- `report:sample` generates fixture-based PDFs without Google or WhatsApp access.
- `report:dry-run` reads the configured live source and generates PDFs, but never sends them.
- `whatsapp:login` opens the persistent WhatsApp Web session and displays a QR code when authentication is needed; it never sends a message.
- `npm start` starts the long-running scheduler. `RUN_ON_START=false` by default.

WhatsApp delivery uses `whatsapp-web.js` with a persistent `LocalAuth` browser profile. No Meta Cloud API or paid API token is used. Real delivery requires `DRY_RUN=false`, `WHATSAPP_ENABLED=true`, and either `TEST_MODE=true` with `WHATSAPP_TEST_RECIPIENT`, or `ALLOW_REAL_DELIVERY=true` for mapped business recipients. Keep the default dry/test settings until the bridge, PDFs, and recipient mapping have been reviewed.

The service auto-detects standard Brave, Chrome, and Edge installations. Set `WHATSAPP_BROWSER_PATH` if the deployment host uses another Chromium location.

The PM2 runtime remains a single service:

```bash
pm2 start src/app.js --name notification-sender
```

Do not start a second instance. The session directories `.wwebjs_auth/` and `.wwebjs_cache/`, recipient mappings, generated PDFs, delivery state, `.env`, and credentials are ignored by Git.

See [docs/architecture.md](docs/architecture.md) for parsing rules, formulas, diagnostics, and known source ambiguities.
