# Architecture and source contract

## Source safety

The service requests values only through the Google Sheets read-only scope. It does not expose a write method. The configured range defaults to `A:DS`, so no row count such as 960 or 1,000 is embedded in application logic.

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
Google Sheets / fixture
  -> source parser
  -> hierarchy resolver + diagnostics
  -> normalized field-force records
  -> TRS/TSM/ASM aggregation
  -> report model
  -> server-side PDF
  -> persistent delivery state
  -> dry-run or guarded WhatsApp provider
```

## Delivery safety

Report IDs are deterministic for `month + report type + entity`. A JSON state store records `GENERATED`, `DRY_RUN`, `QUEUED`, `SENT`, `FAILED`, or `SKIPPED`. A prior `SENT` record prevents another real send. Dry runs never record `SENT`.

Missing recipients are logged and skipped without stopping other reports. Production recipients are blocked unless `ALLOW_REAL_DELIVERY=true`. Test mode always overrides mappings with `WHATSAPP_TEST_RECIPIENT`.

## Remaining source decisions

- Confirm the commercial meaning of current `Sales`/`Delivery` values and the unlabeled negative adjustment.
- Confirm whether aggregate target percentages should be suppressed when any underlying target is missing (the safe default).
- Replace layout-derived ASM assignment with a maintained hierarchy master when available.
- Resolve the `Md. Anisur Rahman` / `Md.Arif Hossain` separator conflict.
- Supply the owner reference PDF for exact visual comparison.
