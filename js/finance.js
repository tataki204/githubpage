const API_URL = 'https://script.google.com/macros/s/AKfycbxjaIndYy2rb4H-792AIc3qLXhdme20KfW9ugmaeR_4PSZJZ1vZbGxPATMuEX5wIUx8/exec';
const CACHE_KEY = 'my-finance-transactions-cache';
const categories = { income: ['Цалин', 'Бизнес', 'Хөрөнгө оруулалт', 'Бусад орлого'], expense: ['Хоол хүнс', 'Тээвэр', 'Орон сууц', 'Хэрэглээ', 'Зугаа', 'Бусад зарлага'] };
let transactions = readCache();
let receiptItems = [];
let userEmail = '';

const byId = (id) => document.getElementById(id);
const money = (amount) => new Intl.NumberFormat('mn-MN').format(amount) + '₮';
const dateText = (date) => new Intl.DateTimeFormat('mn-MN', { month: 'short', day: 'numeric' }).format(new Date(date + 'T00:00:00'));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const configured = () => !API_URL.startsWith('PASTE_');

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch (error) { return []; }
}
function writeCache() { localStorage.setItem(CACHE_KEY, JSON.stringify(transactions)); }
function setStatus(message, connected = false) { byId('syncStatus').innerHTML = `<span class="status-dot"></span>${escapeHtml(message)}`; byId('syncStatus').classList.toggle('connected', connected); }
function showMessage(id, message) { byId(id).textContent = message; }
function updateCategories(type) { byId('category').innerHTML = categories[type].map((item) => `<option value="${item}">${item}</option>`).join(''); }
function transactionPayload(item) { return { ...item, amount: Number(item.amount), userEmail }; }

function render() {
  const selectedMonth = byId('monthFilter').value;
  const visible = transactions.filter((item) => !selectedMonth || item.date.startsWith(selectedMonth));
  const income = visible.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = visible.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
  byId('incomeAmount').textContent = money(income); byId('expenseAmount').textContent = money(expense); byId('balanceAmount').textContent = money(income - expense);
  byId('balanceNote').textContent = visible.length ? `${visible.length} гүйлгээ бүртгэгдсэн` : 'Бүртгэл нэмээд эхлээрэй';
  const list = byId('transactionList'); byId('emptyState').style.display = visible.length ? 'none' : 'block';
  list.innerHTML = visible.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((item) => `<div class="transaction"><span class="transaction-icon ${item.type}">${item.type === 'income' ? '↓' : '↑'}</span><div><p class="transaction-name">${escapeHtml(item.category)}</p><span class="transaction-date">${dateText(item.date)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</span></div><span class="transaction-value ${item.type}">${item.type === 'income' ? '+' : '-'}${money(item.amount)}</span><button class="delete-transaction" data-transaction-id="${escapeHtml(item.id)}" type="button" aria-label="Гүйлгээ устгах">×</button></div>`).join('');
  document.querySelectorAll('[data-transaction-id]').forEach((button) => button.addEventListener('click', () => deleteTransaction(button.dataset.transactionId)));
}

async function apiRequest(path = '', options = {}) {
  if (!configured()) throw new Error('finance.js дотор API_URL-ээ Apps Script Web App URL-р тохируулна уу.');
  const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8', ...(options.headers || {}) } });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.error || `Backend error (${response.status}).`);
    return body.data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Backend хүсэлт хугацаа хэтэрлээ.');
    if (error instanceof SyntaxError) throw new Error('Backend буруу JSON хариу өглөө.');
    throw error;
  } finally { window.clearTimeout(timeout); }
}

async function loadTransactions() {
  if (!configured()) { setStatus('Backend тохируулаагүй'); showMessage('loginMessage', 'js/finance.js дотор API_URL-д Apps Script Web App URL оруулна уу.'); return; }
  setStatus('Өгөгдөл ачаалж байна...');
  try { transactions = await apiRequest(`?action=list${userEmail ? `&userEmail=${encodeURIComponent(userEmail)}` : ''}`); writeCache(); render(); setStatus('Google Sheet-тэй холбогдсон', true); showMessage('sheetMessage', 'Google Sheet-ээс өгөгдөл шинэчлэгдлээ.'); }
  catch (error) { render(); setStatus('Offline cache'); showMessage('sheetMessage', `Ачаалж чадсангүй: ${error.message}`); }
}

async function saveTransaction(item, messageId = 'formMessage') {
  try { const saved = await apiRequest('', { method: 'POST', body: JSON.stringify({ action: 'add', transaction: transactionPayload(item) }) }); transactions.push(saved); writeCache(); render(); showMessage(messageId, 'Амжилттай хадгалагдлаа.'); setStatus('Google Sheet-тэй холбогдсон', true); return true; }
  catch (error) { showMessage(messageId, `Хадгалсангүй: ${error.message}`); setStatus('Хадгалж чадсангүй'); return false; }
}

async function deleteTransaction(id) {
  if (!window.confirm('Энэ гүйлгээг устгах уу?')) return;
  try { await apiRequest('', { method: 'POST', body: JSON.stringify({ action: 'delete', id, userEmail }) }); transactions = transactions.filter((item) => String(item.id) !== String(id)); writeCache(); render(); showMessage('sheetMessage', 'Гүйлгээ устгагдлаа.'); }
  catch (error) { showMessage('sheetMessage', `Устгасангүй: ${error.message}`); }
}

function renderReceipt() {
  const total = receiptItems.reduce((sum, item) => sum + item.price * item.quantity, 0); byId('receiptTotal').textContent = money(total);
  byId('receiptItems').innerHTML = receiptItems.map((item, index) => `<div class="receipt-item"><span>${escapeHtml(item.name)} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong><button type="button" data-receipt-index="${index}" aria-label="Устгах">×</button></div>`).join('');
  document.querySelectorAll('[data-receipt-index]').forEach((button) => button.addEventListener('click', () => { receiptItems.splice(Number(button.dataset.receiptIndex), 1); renderReceipt(); }));
}
function addReceiptItem() { const name = byId('receiptName').value.trim(); const price = Number(byId('receiptPrice').value); const quantity = Number(byId('receiptQuantity').value); if (!name || price <= 0 || quantity <= 0) { showMessage('receiptMessage', 'Барааны нэр, үнэ, тоог зөв оруулна уу.'); return; } receiptItems.push({ name, price, quantity }); byId('receiptName').value = ''; byId('receiptPrice').value = ''; byId('receiptQuantity').value = 1; renderReceipt(); }
async function saveReceipt() { const total = receiptItems.reduce((sum, item) => sum + item.price * item.quantity, 0); if (!total) { showMessage('receiptMessage', 'Эхлээд баримтад бараа нэмнэ үү.'); return; } const item = { id: String(Date.now()), type: 'expense', amount: total, category: 'Хоол хүнс', date: byId('date').value, note: `Баримт: ${receiptItems.map((receiptItem) => receiptItem.name).join(', ')}`, createdAt: new Date().toISOString() }; if (await saveTransaction(item, 'receiptMessage')) { receiptItems = []; renderReceipt(); showMessage('receiptMessage', 'Баримт зарлагаар хадгалагдлаа.'); } }

function signIn() { if (!configured()) { showMessage('loginMessage', 'Эхлээд finance.js дотор API_URL-ээ тохируулна уу.'); return; } const email = window.prompt('Таны Google Sheet дээр ашиглах email оруулна уу:'); if (!email || !email.includes('@')) { showMessage('loginMessage', 'Зөв email оруулж байж үргэлжлүүлнэ үү.'); return; } userEmail = email.trim().toLowerCase(); byId('financeApp').classList.remove('hidden'); byId('loginScreen').classList.add('hidden'); loadTransactions(); }
byId('loginButton').addEventListener('click', signIn);
byId('signOutButton').addEventListener('click', () => { byId('financeApp').classList.add('hidden'); byId('loginScreen').classList.remove('hidden'); setStatus('Backend-тэй холбогдоогүй'); });
byId('refreshButton').addEventListener('click', loadTransactions);
byId('monthFilter').addEventListener('change', render);
byId('clearButton').addEventListener('click', async () => { if (!transactions.length || !window.confirm('Бүх гүйлгээг устгах уу?')) return; try { await apiRequest('', { method: 'POST', body: JSON.stringify({ action: 'clear', userEmail }) }); transactions = []; writeCache(); render(); showMessage('sheetMessage', 'Бүх гүйлгээ устгагдлаа.'); } catch (error) { showMessage('sheetMessage', `Цэвэрлэсэнгүй: ${error.message}`); } });
document.querySelectorAll('.type-button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.type-button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); byId('transactionType').value = button.dataset.type; updateCategories(button.dataset.type); }));
byId('transactionForm').addEventListener('submit', async (event) => { event.preventDefault(); const item = { id: String(Date.now()), type: byId('transactionType').value, amount: Number(byId('amount').value), category: byId('category').value, date: byId('date').value, note: byId('note').value.trim(), createdAt: new Date().toISOString() }; if (!item.amount || item.amount <= 0 || !['income', 'expense'].includes(item.type)) { showMessage('formMessage', 'Дүн болон төрөл зөв эсэхийг шалгана уу.'); return; } if (await saveTransaction(item)) { event.target.reset(); byId('date').valueAsDate = new Date(); updateCategories('income'); } });
byId('addReceiptItem').addEventListener('click', addReceiptItem); byId('saveReceiptButton').addEventListener('click', saveReceipt);
byId('date').valueAsDate = new Date(); byId('monthFilter').value = new Date().toISOString().slice(0, 7); updateCategories('income'); render(); renderReceipt();
