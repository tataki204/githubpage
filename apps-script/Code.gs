const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'Transactions';
const HEADERS = ['id', 'date', 'type', 'category', 'amount', 'note', 'createdAt', 'userEmail'];
const ALLOWED_USER_EMAIL = '';

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';
    if (action !== 'list') return jsonResponse({ success: false, error: 'Unsupported GET action.' });
    const userEmail = String((e.parameter && e.parameter.userEmail) || '').trim();
    return jsonResponse({ success: true, data: listTransactions(userEmail) });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const payload = parseRequest(e);
    const action = payload.action;
    if (!['add', 'update', 'delete', 'clear'].includes(action)) throw new Error('Unsupported action.');
    const result = handleAction(action, payload);
    return jsonResponse({ success: true, data: result });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function handleAction(action, payload) {
  const sheet = getTransactionsSheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (action === 'add') return addTransaction(sheet, payload.transaction);
    if (action === 'update') return updateTransaction(sheet, payload.transaction);
    if (action === 'delete') return deleteTransaction(sheet, payload.id, payload.userEmail);
    return clearTransactions(sheet, payload.userEmail);
  } finally {
    lock.releaseLock();
  }
}

function getTransactionsSheet() {
  if (SPREADSHEET_ID.startsWith('PASTE_')) throw new Error('Configure SPREADSHEET_ID in Code.gs first.');
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  ensureHeaders(sheet);
  return sheet;
}

function ensureHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const current = headerRange.getValues()[0];
  if (HEADERS.some((header, index) => current[index] !== header)) headerRange.setValues([HEADERS]);
}

function listTransactions(userEmail) {
  const sheet = getTransactionsSheet();
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  return rows.map(rowToTransaction).filter(transaction => !userEmail || transaction.userEmail === userEmail);
}

function addTransaction(sheet, rawTransaction) {
  const transaction = validateTransaction(rawTransaction);
  if (findRow(sheet, transaction.id, transaction.userEmail) !== -1) throw new Error('A transaction with this ID already exists.');
  sheet.appendRow(transactionToRow(transaction));
  return transaction;
}

function updateTransaction(sheet, rawTransaction) {
  const transaction = validateTransaction(rawTransaction);
  const row = findRow(sheet, transaction.id, transaction.userEmail);
  if (row === -1) throw new Error('Transaction not found.');
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([transactionToRow(transaction)]);
  return transaction;
}

function deleteTransaction(sheet, id, userEmail) {
  const row = findRow(sheet, String(id || '').trim(), String(userEmail || '').trim());
  if (row === -1) throw new Error('Transaction not found.');
  sheet.deleteRow(row);
  return { id: String(id) };
}

function clearTransactions(sheet, userEmail) {
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  const matchingRows = rows.map((row, index) => ({ row: index + 2, email: String(row[7] || '') })).filter(item => !userEmail || item.email === userEmail).reverse();
  matchingRows.forEach(item => sheet.deleteRow(item.row));
  return { deleted: matchingRows.length };
}

function findRow(sheet, id, userEmail) {
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  for (let index = 0; index < rows.length; index += 1) {
    if (String(rows[index][0]) === String(id) && (!userEmail || String(rows[index][7]) === userEmail)) return index + 2;
  }
  return -1;
}

function validateTransaction(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Transaction is required.');
  const transaction = {
    id: String(raw.id || '').trim(), date: String(raw.date || '').trim(), type: String(raw.type || '').trim(),
    category: String(raw.category || '').trim(), amount: Number(raw.amount), note: String(raw.note || '').trim(),
    createdAt: String(raw.createdAt || '').trim(), userEmail: String(raw.userEmail || '').trim()
  };
  if (!transaction.id || !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date) || !['income', 'expense'].includes(transaction.type) || !transaction.category || !Number.isFinite(transaction.amount) || transaction.amount <= 0 || !transaction.createdAt || !transaction.userEmail) throw new Error('Invalid transaction data.');
  if (ALLOWED_USER_EMAIL && transaction.userEmail !== ALLOWED_USER_EMAIL) throw new Error('This user is not allowed.');
  return transaction;
}

function transactionToRow(transaction) { return [transaction.id, transaction.date, transaction.type, transaction.category, transaction.amount, transaction.note, transaction.createdAt, transaction.userEmail]; }
function rowToTransaction(row) { return { id: String(row[0]), date: formatDate(row[1]), type: String(row[2]), category: String(row[3]), amount: Number(row[4]), note: String(row[5] || ''), createdAt: formatDateTime(row[6]), userEmail: String(row[7] || '') }; }
function formatDate(value) { return value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(value); }
function formatDateTime(value) { return value instanceof Date ? value.toISOString() : String(value); }
function parseRequest(e) { if (!e || !e.postData || !e.postData.contents) throw new Error('Request body is required.'); return JSON.parse(e.postData.contents); }
function jsonResponse(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
