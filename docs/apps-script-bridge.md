# Controlled Apps Script read-only bridge

The bridge is a deliberately narrow, POST-only boundary for Apps Script project
`1xOnrcVDozZKVE4OfRqMlDRJ-xhQCS8UNoWSvwfbHVX5Lmlc5Fuu67R2E`.

## Security boundary

- The spreadsheet ID, source tab, source header row, source columns, and maximum source row/column bounds are constants in `SalesDataBridge.js`.
- Authentication is evaluated before the action. Every denied or failed request returns the same `request_denied` response.
- Callers cannot select a spreadsheet, tab, or range. Extra request properties are ignored.
- The raw token exists only in the Node host's ignored `.env`. Apps Script stores only its lowercase SHA-256 digest.
- There is no `doGet` function.
- The manifest has only `spreadsheets.readonly` and declares a web app that executes as the deployer.
- The response projects only ID, hierarchy names, designation, hierarchy territory, sales, target, orders, and working days. Dealer/customer text is blanked on SR rows. Salary, TADA, joining dates, phone/contact fields, recipient mappings, and unused source columns are never returned.
- Dashboard configuration is read from fixed cells only. The bridge does not read the test-recipient cell or the recipient-mapping table.

Required Script Property name:

```text
SALES_BRIDGE_TOKEN_SHA256
```

The value must be exactly 64 lowercase hexadecimal characters: the SHA-256 digest of a randomly generated raw token containing at least 32 random bytes. Never place the raw token in Apps Script, Script Properties, source control, the Sheet, a URL, or logs.

## Versioned deployment

Do not modify the unexplained existing HEAD deployment. After the property above is installed by the owner:

1. Confirm the remote project contains `Code.js`, `SalesDataBridge.js`, and `appsscript.json`, with the empty `myFunction` preserved.
2. Create an immutable version with a descriptive label.
3. Create a **new** web-app deployment for that version.
4. Execute as: **User deploying the web app**.
5. Access: **Anyone, including anonymous**. Anonymous access is necessary only because the high-entropy POST token replaces Google OAuth for the Node service.
6. Authorize only `https://www.googleapis.com/auth/spreadsheets.readonly`.
7. Put the new `/exec` URL and raw token in the ignored `.env` as `APPS_SCRIPT_BRIDGE_URL` and `APPS_SCRIPT_BRIDGE_TOKEN`.

Before using live data, verify GET, no-token POST, bad-token POST, valid-token POST, caller-supplied source selectors, response headers, and response values. A valid response must report schema version 2 and exactly ten projected columns.

Rotate the token immediately if either the raw token or its Node environment is exposed.
