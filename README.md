# My Finance

GitHub Pages frontend + Google Apps Script Web App + Google Sheets database.

## Files

- `index.html` and `css/style.css`: existing finance UI.
- `js/finance.js`: frontend API client. Set `API_URL` near the top to the deployed Apps Script Web App URL.
- `apps-script/Code.gs`: backend. Paste this file into a new Google Apps Script project.

## Google Sheet setup

1. Create a spreadsheet named `My Finance DB`.
2. Copy its ID from the URL between `/d/` and `/edit`.
3. Open **Extensions > Apps Script**.
4. Paste `apps-script/Code.gs` into the script editor.
5. Replace `PASTE_YOUR_SPREADSHEET_ID_HERE` with the spreadsheet ID.
6. Save the project. The `Transactions` tab and exact header row are created automatically on the first request:

`id | date | type | category | amount | note | createdAt | userEmail`

## Deploy Apps Script

1. Select **Deploy > New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
5. Authorize the script and copy the Web app URL ending in `/exec`.
6. In `js/finance.js`, replace `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE` in `API_URL` with that URL.
7. Push the frontend to GitHub Pages.

This uses Apps Script and Sheets only; Google Cloud billing, service accounts, and the Sheets REST API are not required.

## Data behavior

Google Sheets is the source of truth. `localStorage` is only a cache used to keep the last loaded view visible when the backend is temporarily unavailable. New transactions are never reported as saved until Apps Script confirms success.

The frontend asks for an email label on login so rows can be separated by `userEmail`. This is not secure authentication. For a truly private deployment, keep the Web App URL private or set `ALLOWED_USER_EMAIL` in `Code.gs` to the only permitted email. Anyone who can access an `Anyone` Web App URL may otherwise call it.

## API

- `GET ?action=list&userEmail=...`: list transactions.
- `POST {"action":"add","transaction":{...}}`: add with validation and duplicate-ID protection.
- `POST {"action":"update","transaction":{...}}`: update by ID.
- `POST {"action":"delete","id":"...","userEmail":"..."}`: delete by ID.
- `POST {"action":"clear","userEmail":"..."}`: clear the matching user's rows.
# githubpage