# Controlled Apps Script read-only bridge

This repository contains the proposed bridge source in `apps-script/`. It has not been pushed or deployed to Apps Script. The controlled target project is:

```text
1xOnrcVDozZKVE4OfRqMlDRJ-xhQCS8UNoWSvwfbHVX5Lmlc5Fuu67R2E
```

The audited project currently contains only an empty `myFunction` and one HEAD deployment. A future controlled synchronization can add `SalesDataBridge.js` without depending on or changing the old `Sales_Report_Reminder` project.

## Why a bridge

- Node needs only an HTTPS URL and one high-entropy token; it needs no Google credential file.
- The Apps Script deployment executes as its owner and requests only the Sheets read-only scope.
- Spreadsheet ID, tab, and maximum columns are server-side properties. Callers cannot request another spreadsheet or tab.
- The bridge has no write operation and never changes source values, formulas, formatting, or structure.
- The token travels in a POST body, not a query string, and Node refuses non-Google bridge hosts.

Publishing the spreadsheet or using an unauthenticated CSV export was rejected because it would unnecessarily expose business data. Apps Script Execution API/OAuth was rejected because it recreates the local credential complexity this bridge is intended to remove.

## Future deployment procedure (not performed)

1. Review `apps-script/SalesDataBridge.js` and `apps-script/appsscript.json`.
2. Add the bridge file to the specified Apps Script project without deleting or overwriting unrelated files.
3. In Apps Script Project Settings, set these Script Properties:

   - `SALES_SPREADSHEET_ID`: `1gkKk3rk-mvVO3CIulFCswD8GvFDHo_5TGzAIqBzYqC0`
   - `SALES_SHEET_TAB`: `Sales Data Base Monthly`
   - `SALES_MAX_COLUMNS`: `123`
   - `SALES_BRIDGE_TOKEN`: a unique, randomly generated secret of at least 32 bytes

4. Deploy a web app that executes as the deploying owner and set access to `Anyone` so Node does not need Google OAuth. The high-entropy bearer-token check remains mandatory; if the Workspace administrator prohibits anonymous web apps, Google OAuth becomes a genuine deployment constraint.
5. Authorize only the manifest's read-only Sheets scope.
6. Put the deployment `/exec` URL and the same token in the new service's untracked `.env`:

   ```env
   GOOGLE_DATA_SOURCE=apps_script
   APPS_SCRIPT_BRIDGE_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
   APPS_SCRIPT_BRIDGE_TOKEN=replace-with-the-secret
   GOOGLE_SHEET_ID=1gkKk3rk-mvVO3CIulFCswD8GvFDHo_5TGzAIqBzYqC0
   GOOGLE_SHEET_TAB=Sales Data Base Monthly
   ```

7. Run `npm run report:dry-run`. This path reads live data and creates PDFs but cannot initialize or send through WhatsApp.

Rotate the bridge token immediately if it is exposed. Never commit it, paste it into a URL, or store it in the spreadsheet.
