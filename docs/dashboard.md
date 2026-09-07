# Google Sheets Dashboard contract

The `Dashboard` tab is a non-secret control panel. The source tab remains `Sales Data Base Monthly` and is never written by this service.

## Fixed settings read by the bridge

| Setting | Cell | Default | Effective safety rule |
| --- | --- | --- | --- |
| Reporting month | B14 | AUTO | Auto-detect unless a valid override is supplied |
| Monthly working days | B15 | AUTO | Read source unless a positive integer is supplied |
| Enable TRS/TSM/ASM | B17:B19 | TRUE | Controls generated report levels |
| PDF output settings | B20 | standard | Non-secret display/layout profile |
| Report generation mode | B21 | all | Non-secret run intent |
| WhatsApp enabled | B24 | FALSE | Effective only when environment also enables it |
| Dry run | B25 | TRUE | Either Dashboard or environment can force dry-run |
| Test mode | B26 | TRUE | Either Dashboard or environment can force test mode |
| Allow real delivery | B27 | FALSE | Effective only when environment also allows it |
| Caption template | B29 | standard template | Non-secret text template |
| Duplicate protection | B30 | TRUE | Node safety floor remains enabled |
| Retry attempts/delay | B31:B32 | 1 / 30 | Positive integers only |

The bridge intentionally excludes B28 (`Test recipient`) and F:I (`Recipient Mapping`) because contact information must not cross the sales-data bridge. Test-recipient and production recipient resolution remain environment/ignored-file controlled.

## Intended layout

- A3:B11 — System Status
- A13:B21 — Report Settings
- A23:B32 — Delivery Settings
- F3:I103 — Recipient Mapping (`Type | Name | WhatsApp Number | Enabled`), initially blank
- F14:G21 — Run Control instructions; no automatic or one-click sender
- M3:N14 — Data Quality status
- `Report History!A:I` — bounded log table (`Report ID | Type | Name | Month | Generated time | Status | Delivery status | Recipient | Error`)

No token, credential, private key, WhatsApp session, or real phone number belongs on the Dashboard. The Node host owns `APPS_SCRIPT_BRIDGE_TOKEN`, the web-app URL, the WhatsApp session directory, the test recipient, and the one-report test selector.

The first live test delivery additionally requires `WHATSAPP_TEST_REPORT_ID`; the job skips every other report so a test-mode run cannot fan out one PDF per entity.
