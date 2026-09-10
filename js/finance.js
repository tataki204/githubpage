const STORAGE_KEY = 'my-finance-transactions';
const SETTINGS_KEY = 'my-finance-settings';
const categories = { income: ['Цалин', 'Бизнес', 'Хөрөнгө оруулалт', 'Бусад орлого'], expense: ['Хоол хүнс', 'Тээвэр', 'Орон сууц', 'Хэрэглээ', 'Зугаа', 'Бусад зарлага'] };
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
let receiptItems = [];
const byId = (id) => document.getElementById(id);
const money = (amount) => new Intl.NumberFormat('mn-MN').format(amount) + '₮';
const dateText = (date) => new Intl.DateTimeFormat('mn-MN', { month: 'short', day: 'numeric' }).format(new Date(date + 'T00:00:00'));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
function updateCategories(type) { byId('category').innerHTML = categories[type].map((item) => `<option value="${item}">${item}</option>`).join(''); }
function render() {
  const selectedMonth = byId('monthFilter').value;
  const visible = transactions.filter((item) => !selectedMonth || item.date.startsWith(selectedMonth));
  const income = visible.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = visible.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  byId('incomeAmount').textContent = money(income); byId('expenseAmount').textContent = money(expense); byId('balanceAmount').textContent = money(income - expense);
  byId('balanceNote').textContent = visible.length ? `${visible.length} гүйлгээ бүртгэгдсэн` : 'Бүртгэл нэмээд эхлээрэй';
  const list = byId('transactionList'); byId('emptyState').style.display = visible.length ? 'none' : 'block';
  list.innerHTML = visible.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((item) => `<div class="transaction"><span class="transaction-icon ${item.type}">${item.type === 'income' ? '↓' : '↑'}</span><div><p class="transaction-name">${escapeHtml(item.category)}</p><span class="transaction-date">${dateText(item.date)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</span></div><span class="transaction-value ${item.type}">${item.type === 'income' ? '+' : '-'}${money(item.amount)}</span></div>`).join('');
}
function showMessage(id, message) { byId(id).textContent = message; window.setTimeout(() => { byId(id).textContent = ''; }, 3500); }
function renderReceipt() {
  const total = receiptItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  byId('receiptTotal').textContent = money(total);
  byId('receiptItems').innerHTML = receiptItems.map((item, index) => `<div class="receipt-item"><span>${escapeHtml(item.name)} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong><button type="button" data-receipt-index="${index}" aria-label="Устгах">×</button></div>`).join('');
  document.querySelectorAll('[data-receipt-index]').forEach((button) => button.addEventListener('click', () => { receiptItems.splice(Number(button.dataset.receiptIndex), 1); renderReceipt(); }));
}
function addReceiptItem() {
  const name = byId('receiptName').value.trim(); const price = Number(byId('receiptPrice').value); const quantity = Number(byId('receiptQuantity').value);
  if (!name || price <= 0 || quantity <= 0) { showMessage('receiptMessage', 'Барааны нэр, үнэ, тоог зөв оруулна уу.'); return; }
  receiptItems.push({ name, price, quantity }); byId('receiptName').value = ''; byId('receiptPrice').value = ''; byId('receiptQuantity').value = 1; renderReceipt();
}
function saveReceipt() {
  const total = receiptItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (!total) { showMessage('receiptMessage', 'Эхлээд баримтад бараа нэмнэ үү.'); return; }
  const item = { id: Date.now(), type: 'expense', amount: total, category: 'Хоол хүнс', date: byId('date').value || new Date().toISOString().slice(0, 10), note: `Баримт: ${receiptItems.map((receiptItem) => receiptItem.name).join(', ')}` };
  transactions.push(item); localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); receiptItems = []; renderReceipt(); render(); showMessage('receiptMessage', 'Баримтын нийт дүн зарлагаар бүртгэгдлээ.'); syncToSheet(item);
}
document.querySelectorAll('.type-button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.type-button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); byId('transactionType').value = button.dataset.type; updateCategories(button.dataset.type); }));
byId('transactionForm').addEventListener('submit', (event) => { event.preventDefault(); const item = { id: Date.now(), type: byId('transactionType').value, amount: Number(byId('amount').value), category: byId('category').value, date: byId('date').value, note: byId('note').value.trim() }; transactions.push(item); localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); event.target.reset(); byId('date').valueAsDate = new Date(); updateCategories('income'); showMessage('formMessage', 'Гүйлгээ амжилттай бүртгэгдлээ.'); render(); syncToSheet(item); });
byId('monthFilter').addEventListener('change', render);
byId('clearButton').addEventListener('click', () => { if (transactions.length && window.confirm('Бүх гүйлгээг устгах уу?')) { transactions = []; localStorage.removeItem(STORAGE_KEY); render(); } });
byId('loginButton').addEventListener('click', signInWithGoogle);
byId('signOutButton').addEventListener('click', () => { accessToken = null; byId('financeApp').classList.add('hidden'); byId('loginScreen').classList.remove('hidden'); byId('loginMessage').textContent = 'Та гарлаа. Дахин нэвтэрч үргэлжлүүлнэ үү.'; });
byId('connectSheetsButton').addEventListener('click', () => { const id = byId('spreadsheetId').value.trim(); if (!id) { showMessage('sheetMessage', 'Spreadsheet ID оруулна уу.'); return; } settings.spreadsheetId = id; localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); showMessage('sheetMessage', 'Sheet хадгалагдлаа. Одоо Google-ээр нэвтэрнэ үү.'); });
byId('addReceiptItem').addEventListener('click', addReceiptItem);
byId('saveReceiptButton').addEventListener('click', saveReceipt);
const GOOGLE_CLIENT_ID = 'PASTE_YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
let accessToken = null;
function signInWithGoogle() {
  if (GOOGLE_CLIENT_ID.startsWith('PASTE_')) { byId('loginMessage').textContent = 'Эхлээд finance.js дотор Google OAuth Client ID-гаа тохируулна уу.'; return; }
  byId('loginButton').disabled = true; byId('loginMessage').textContent = 'Google нэвтрэлтийг нээж байна...';
  const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.onload = () => { const client = google.accounts.oauth2.initTokenClient({ client_id: GOOGLE_CLIENT_ID, scope: SHEETS_SCOPE, callback: (response) => { accessToken = response.access_token; byId('financeApp').classList.remove('hidden'); byId('loginScreen').classList.add('hidden'); byId('syncStatus').classList.add('connected'); byId('loginButton').disabled = false; showMessage('sheetMessage', 'Google нэвтрэлт амжилттай.'); } }); client.requestAccessToken(); }; script.onerror = () => { byId('loginButton').disabled = false; byId('loginMessage').textContent = 'Google нэвтрэлтийн цонхыг ачаалж чадсангүй.'; }; document.head.appendChild(script);
}
async function syncToSheet(item) {
  if (!settings.spreadsheetId || !accessToken) return;
  try { const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${settings.spreadsheetId}/values/Transactions!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [[item.date, item.type === 'income' ? 'Орлого' : 'Зарлага', item.category, item.amount, item.note, new Date().toISOString()]] }) }); if (!response.ok) showMessage('sheetMessage', 'Sheet-д хадгалж чадсангүй. Spreadsheet ID болон Transactions tab-аа шалгана уу.'); else showMessage('sheetMessage', 'Google Sheet-д хадгалагдлаа.'); } catch (error) { showMessage('sheetMessage', 'Google Sheet холболт тасарлаа.'); }
}
byId('date').valueAsDate = new Date(); byId('monthFilter').value = new Date().toISOString().slice(0, 7); byId('spreadsheetId').value = settings.spreadsheetId || ''; updateCategories('income'); render(); renderReceipt();
