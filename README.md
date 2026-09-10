# My Finance

Existing GitHub Pages finance UI using Firebase Authentication and Cloud Firestore. The interface, dashboard, categories, month filter, transaction form, and receipt calculator remain vanilla HTML/CSS/JavaScript.

## Architecture

`GitHub Pages -> Firebase Authentication -> Cloud Firestore`

Firestore is the source of truth. No Apps Script, Google Sheets API, service account, server, or paid backend is used. The app does not use localStorage for financial data, so logout cannot leave another user's cached transactions visible.

## Firebase setup

1. Create a Firebase project at the Firebase Console.
2. Keep the project on the Spark free plan. Do not enable billing.
3. In **Build > Authentication > Sign-in method**, enable **Google**.
4. In **Build > Firestore Database**, create a database in production mode.
5. Register a Web app in **Project settings > Your apps**.
6. The current project config is in `js/firebase.js`; replace it only if you create a different Firebase project.
7. In **Authentication > Settings > Authorized domains**, add `tataki204.github.io`.
8. Publish the complete contents of `firestore.rules` in **Firestore Database > Rules**, then click **Publish**.

The public Firebase web config is not a password. Firestore Security Rules and Firebase Auth are the security boundary. Never add Admin SDK credentials or service account keys to this repository.

## Firestore structure

```text
users/{uid}/transactions/{transactionId}
```

Each transaction contains `id`, `type`, `amount`, `category`, `date`, `note`, `createdAt`, and `userId`. The document path and `userId` are tied to the authenticated Firebase UID by `firestore.rules`.

## GitHub Pages

Push the repository to GitHub and enable **Settings > Pages > Deploy from branch > main > / (root)**. The Firebase web SDK loads from the official Google CDN, so no Node.js build step is needed.

## Testing

1. Open the GitHub Pages URL.
2. Sign in with Google.
3. Add income and expense transactions.
4. Add receipt items and save the receipt as an expense.
5. Check the dashboard and month filter.
6. Delete a transaction and refresh the page.
7. Sign out, then sign in as another account. The previous account's transactions must not appear.
8. Use Firestore Rules Playground or the Firebase Emulator to verify unauthenticated and cross-user reads/writes are denied.

## Spark plan

This implementation uses only Firebase Authentication and Firestore client SDK features available without a paid server. It does not use Cloud Functions, Cloud Run, Firebase Hosting, Storage, or Admin SDK. Free quotas still apply; if a quota is exceeded, Firebase rejects requests and the UI shows an error rather than claiming a transaction was saved.

## Known limitations

The Google web config is visible in the public frontend by design. This is normal for Firebase web apps. Security depends on Auth and Firestore Rules, not config secrecy. No application can honestly guarantee 100% security, so protect the Google account and review Firestore Rules before using real financial data.
