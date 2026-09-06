# Sales Report by TRS, TSM & ASM

Production-oriented Node.js service for reading the monthly Google Sheet, resolving the current report-block hierarchy, calculating performance metrics, generating server-side PDFs, and delivering documents through a guarded WhatsApp provider.

| Report term | Current source representation |
| --- | --- |
| ASM | Rows whose `Designation` is `A.S.M.` |
| TSM | Rows whose `Designation` is `RSM` |
| TRS | Rows whose `Designation` is `T.S.O.` |
| Field-force person | Rows whose `Designation` is `SR` |

The service never writes to the source spreadsheet. Google access uses the read-only Sheets scope.

## Setup

```bash
npm install
copy .env.example .env
copy config\recipients.example.json config\recipients.json
```

Set `GOOGLE_SHEET_ID` and provide Google Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS`. Share the source spreadsheet with the service-account email when applicable. Recipient mappings are read from `config/recipients.json`.

## Commands

```bash
npm test
npm run lint
npm run report:sample
npm run report:dry-run
npm start
```

- `report:sample` generates fixture-based PDFs without Google or WhatsApp access.
- `report:dry-run` reads the configured live source and generates PDFs, but never sends them.
- `npm start` starts the long-running scheduler. `RUN_ON_START=false` by default.

```bash
pm2 start src/app.js --name notification-sender
```

Real delivery requires `DRY_RUN=false`, `WHATSAPP_ENABLED=true`, valid Meta Cloud API configuration, and either `TEST_MODE=true` with `WHATSAPP_TEST_RECIPIENT`, or `ALLOW_REAL_DELIVERY=true` for mapped business recipients.

See [docs/architecture.md](docs/architecture.md) for parsing rules, formulas, diagnostics, and known source ambiguities.
