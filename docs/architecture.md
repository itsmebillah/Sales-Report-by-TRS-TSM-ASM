# Architecture and source contract

## Source safety

The controlled Apps Script bridge is the only component authorized against Google Sheets. Its manifest requests `spreadsheets.readonly`, it opens only the spreadsheet and tab fixed in Script Properties, and it contains no spreadsheet write method. The bridge determines the current last row dynamically and caps the read at 123 columns (`A:DS`) and 250,000 cells.

Node sends a POST request containing an action and a high-entropy bearer token to an allow-listed Google Apps Script HTTPS host. The token is kept in Script Properties and the untracked Node `.env`; it is not placed in the URL. The response tab is checked before parsing. Response size and request duration are bounded.

## Header and row resolution

The parser finds the header row by the required labels `ID`, `RSM`, `TSO`, and `Designation`. Columns are resolved by normalized header text, not fixed offsets. Source designations are translated into the reporting model:

```text
A.S.M. total row -> ASM
RSM total row    -> TSM
T.S.O. total row -> TRS
SR row           -> individual field-force record
```

An ASM total occurs after its contiguous TSM/RSM blocks. The hierarchy resolver assigns the pending TSM blocks to that ASM. This inference is deterministic, but a diagnostic is emitted because the source does not repeat ASM on detail rows.

Valid T.S.O. summary rows are the canonical TRS-to-TSM mapping by default. Separator rows provide territory names. A separator conflict is always emitted as a diagnostic. `HIERARCHY_CONFLICT_STRATEGY` supports `summary_wins`, `separator_wins`, or `error`; the conflict is never silently hidden.

Known live-source conflict: the Noakhali, Chandpur, and Feni separator rows use `Md. Anisur Rahman`, while their field-force/T.S.O. rows use `Md.Arif Hossain`.

## Calculation policy

- Passed WD = source `Current WD`; aggregate Passed WD = maximum underlying Passed WD because it represents calendar progress, not additive labor days.
- Remaining WD = max(Monthly WD - Passed WD, 0).
- Daily Avg. Sales = Sales / Passed WD.
- Required Daily Sales = max(Target - Sales, 0) / Remaining WD.
- Projection = Daily Avg. Sales x Monthly WD.
- Daily Avg. Memo = Orders / Passed WD.
- Avg. Memo Value = Sales / Orders.
- Achievement % = Sales / Target x 100.
- Projection % = Projection / Target x 100.

All divisions are safe and return `null` when the denominator is unavailable or zero. With `STRICT_TARGET_COVERAGE=true`, an aggregate containing any missing target has no target-derived percentage or required-sales result. Totals are recalculated from underlying records; percentages are never averaged.

## Pipeline

```text
Apps Script read-only bridge / fixture
  -> source parser
  -> hierarchy resolver + diagnostics
  -> normalized field-force records
  -> TRS/TSM/ASM aggregation
  -> report model
  -> server-side PDF
  -> persistent delivery state
  -> dry-run or guarded WhatsApp Web provider
```

## Delivery safety

Report IDs are deterministic for `month + report type + entity`. A JSON state store records `GENERATED`, `DRY_RUN`, `QUEUED`, `SENDING`, `CONFIRMATION_PENDING`, `SENT`, `FAILED`, or `SKIPPED`. A prior `SENT`, `SENDING`, or `CONFIRMATION_PENDING` state prevents another automatic real send. This deliberately favors manual reconciliation over duplicate delivery after a crash or ambiguous WhatsApp acknowledgement. Dry runs never initialize WhatsApp and never record `SENT`.

Missing recipients are logged and skipped without stopping other reports. Production recipients are blocked unless `ALLOW_REAL_DELIVERY=true`. Test mode always overrides mappings with `WHATSAPP_TEST_RECIPIENT`.

WhatsApp uses `whatsapp-web.js`, `LocalAuth`, and a persistent ignored browser profile. The first authentication is performed with `npm run whatsapp:login`. Before dispatch, WhatsApp resolves the international number on its server. PDFs are sent as document attachments with captions; text delivery is also supported. An ACK below server-received status becomes `CONFIRMATION_PENDING` and is not blindly retried.

The project requires Node.js 22.12 or newer and overrides the browser automation dependency to a patched Puppeteer release. The override is pinned and covered by the dependency audit; it must be retested whenever `whatsapp-web.js` changes.

## Remaining source decisions

- Confirm the commercial meaning of current `Sales`/`Delivery` values and the unlabeled negative adjustment.
- Confirm whether aggregate target percentages should be suppressed when any underlying target is missing (the safe default).
- Replace layout-derived ASM assignment with a maintained hierarchy master when available.
- Resolve the `Md. Anisur Rahman` / `Md.Arif Hossain` separator conflict.
- Supply the owner reference PDF for exact visual comparison.
