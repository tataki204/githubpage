import {
  auth, collection, db, deleteDoc, doc, firebaseConfigured, getDocs, googleProvider,
  onAuthStateChanged, orderBy, query, runTransaction, serverTimestamp,
  signInWithPopup, signOut, writeBatch
} from './firebase.js';

const categories = { income: ['Цалин', 'Бизнес', 'Хөрөнгө оруулалт', 'Бусад орлого'], expense: ['Хоол хүнс', 'Тээвэр', 'Орон сууц', 'Хэрэглээ', 'Зугаа', 'Бусад зарлага'] };
const ALLOWED_EMAILS = ['tatakai.javkhaa@gmail.com', 'trader.jabu@gmail.com'];
let transactions = [];
let receiptItems = [];
let currentUser = null;
let editingId = null;

const byId = (id) => document.getElementById(id);
const money = (amount) => new Intl.NumberFormat('mn-MN').format(amount) + '₮';
const dateText = (date) => new Intl.DateTimeFormat('mn-MN', { month: 'short', day: 'numeric' }).format(new Date(date + 'T00:00:00'));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const transactionCollection = () => collection(db, 'users', currentUser.uid, 'transactions');
const transactionReference = (id) => doc(transactionCollection(), String(id));

function showMessage(id, message) { byId(id).textContent = message; }
function setStatus(message, connected = false) { byId('syncStatus').innerHTML = `<span class="status-dot"></span>${escapeHtml(message)}`; byId('syncStatus').classList.toggle('connected', connected); }
function updateCategories(type) { byId('category').innerHTML = categories[type].map((item) => `<option value="${item}">${item}</option>`).join(''); }
function validateTransaction(item) { return /^\d{4}-\d{2}-\d{2}$/.test(item.date) && ['income', 'expense'].includes(item.type) && Number.isFinite(item.amount) && item.amount > 0 && item.amount <= 100000000000 && item.category.length > 0 && item.category.length <= 100 && item.note.length <= 500; }

function render() {
  const selectedMonth = byId('monthFilter').value;
  const visible = transactions.filter((item) => !selectedMonth || item.date.startsWith(selectedMonth));
  const income = visible.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = visible.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
  byId('incomeAmount').textContent = money(income); byId('expenseAmount').textContent = money(expense); byId('balanceAmount').textContent = money(income - expense); byId('balanceNote').textContent = visible.length ? `${visible.length} гүйлгээ бүртгэгдсэн` : 'Бүртгэл нэмээд эхлээрэй';
  const list = byId('transactionList'); byId('emptyState').style.display = visible.length ? 'none' : 'block';
  list.innerHTML = visible.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((item) => `<div class="transaction"><span class="transaction-icon ${item.type}">${item.type === 'income' ? '↓' : '↑'}</span><div><p class="transaction-name">${escapeHtml(item.category)}</p><span class="transaction-date">${dateText(item.date)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</span></div><span class="transaction-value ${item.type}">${item.type === 'income' ? '+' : '-'}${money(item.amount)}</span><span class="transaction-actions"><button class="edit-transaction" data-edit-transaction-id="${escapeHtml(item.id)}" type="button" aria-label="Гүйлгээ засах">✎</button><button class="delete-transaction" data-transaction-id="${escapeHtml(item.id)}" type="button" aria-label="Гүйлгээ устгах">×</button></span></div>`).join('');
  document.querySelectorAll('[data-edit-transaction-id]').forEach((button) => button.addEventListener('click', () => beginEdit(button.dataset.editTransactionId)));
  document.querySelectorAll('[data-transaction-id]').forEach((button) => button.addEventListener('click', () => deleteTransaction(button.dataset.transactionId)));
}

async function loadTransactions() {
  setStatus('Өгөгдөл ачаалж байна...');
  try { const snapshot = await getDocs(query(transactionCollection(), orderBy('date', 'desc'))); transactions = snapshot.docs.map((item) => ({ ...item.data(), id: item.id })); render(); setStatus('Firestore-тэй холбогдсон', true); showMessage('sheetMessage', 'Өгөгдөл шинэчлэгдлээ.'); }
  catch (error) { transactions = []; render(); setStatus('Firestore алдаа'); showMessage('sheetMessage', `Өгөгдөл ачаалж чадсангүй: ${error.message}`); }
}

async function saveTransaction(item, messageId = 'formMessage') {
  if (!currentUser) { showMessage(messageId, 'Эхлээд нэвтэрнэ үү.'); return false; }
  if (!validateTransaction(item)) { showMessage(messageId, 'Дүн, төрөл, огноо, тэмдэглэлийг шалгана уу.'); return false; }
  const reference = transactionReference(item.id);
  try { await runTransaction(db, async (transaction) => { const existing = await transaction.get(reference); if (existing.exists()) throw new Error('Энэ гүйлгээ аль хэдийн бүртгэгдсэн байна.'); transaction.set(reference, { ...item, userId: currentUser.uid, createdAt: serverTimestamp() }); }); await loadTransactions(); showMessage(messageId, 'Амжилттай хадгалагдлаа.'); return true; }
  catch (error) { showMessage(messageId, `Хадгалсангүй: ${error.message}`); return false; }
}

async function updateTransaction(item) {
  if (!currentUser || !validateTransaction(item)) throw new Error('Гүйлгээний мэдээлэл буруу байна.');
  await runTransaction(db, async (transaction) => { const reference = transactionReference(item.id); const existing = await transaction.get(reference); if (!existing.exists() || existing.data().userId !== currentUser.uid) throw new Error('Гүйлгээ олдсонгүй.'); transaction.update(reference, { ...item, userId: currentUser.uid, createdAt: existing.data().createdAt || serverTimestamp() }); });
  await loadTransactions();
}

function beginEdit(id) { const item = transactions.find((transaction) => String(transaction.id) === String(id)); if (!item) return; editingId = item.id; byId('transactionType').value = item.type; document.querySelectorAll('.type-button').forEach((button) => button.classList.toggle('active', button.dataset.type === item.type)); updateCategories(item.type); byId('amount').value = item.amount; byId('category').value = item.category; byId('date').value = item.date; byId('note').value = item.note || ''; byId('submitTransactionButton').firstChild.textContent = 'Хадгалах '; byId('cancelEditButton').classList.remove('hidden'); byId('amount').focus(); }
function resetTransactionForm() { editingId = null; byId('transactionForm').reset(); byId('date').valueAsDate = new Date(); updateCategories('income'); document.querySelectorAll('.type-button').forEach((button) => button.classList.toggle('active', button.dataset.type === 'income')); byId('transactionType').value = 'income'; byId('submitTransactionButton').firstChild.textContent = 'Бүртгэх '; byId('cancelEditButton').classList.add('hidden'); }

async function deleteTransaction(id) { if (!currentUser || !window.confirm('Энэ гүйлгээг устгах уу?')) return; try { await deleteDoc(transactionReference(id)); await loadTransactions(); showMessage('sheetMessage', 'Гүйлгээ устгагдлаа.'); } catch (error) { showMessage('sheetMessage', `Устгасангүй: ${error.message}`); } }
async function clearTransactions() { if (!currentUser || !transactions.length || !window.confirm('Бүх гүйлгээг устгах уу?')) return; try { const snapshot = await getDocs(transactionCollection()); const batch = writeBatch(db); snapshot.docs.forEach((item) => batch.delete(item.ref)); await batch.commit(); await loadTransactions(); showMessage('sheetMessage', 'Бүх гүйлгээ устгагдлаа.'); } catch (error) { showMessage('sheetMessage', `Цэвэрлэсэнгүй: ${error.message}`); } }

function renderReceipt() { const total = receiptItems.reduce((sum, item) => sum + item.price * item.quantity, 0); byId('receiptTotal').textContent = money(total); byId('receiptItems').innerHTML = receiptItems.map((item, index) => `<div class="receipt-item"><span>${escapeHtml(item.name)} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong><button type="button" data-receipt-index="${index}" aria-label="Устгах">×</button></div>`).join(''); document.querySelectorAll('[data-receipt-index]').forEach((button) => button.addEventListener('click', () => { receiptItems.splice(Number(button.dataset.receiptIndex), 1); renderReceipt(); })); }
function addReceiptItem() { const name = byId('receiptName').value.trim(); const price = Number(byId('receiptPrice').value); const quantity = Number(byId('receiptQuantity').value); if (!name || price <= 0 || quantity <= 0) { showMessage('receiptMessage', 'Барааны нэр, үнэ, тоог зөв оруулна уу.'); return; } receiptItems.push({ name, price, quantity }); byId('receiptName').value = ''; byId('receiptPrice').value = ''; byId('receiptQuantity').value = 1; renderReceipt(); }
async function saveReceipt() { const total = receiptItems.reduce((sum, item) => sum + item.price * item.quantity, 0); if (!total) { showMessage('receiptMessage', 'Эхлээд баримтад бараа нэмнэ үү.'); return; } const item = { id: crypto.randomUUID(), type: 'expense', amount: total, category: 'Хоол хүнс', date: byId('date').value, note: `Баримт: ${receiptItems.map((receiptItem) => receiptItem.name).join(', ')}` }; if (await saveTransaction(item, 'receiptMessage')) { receiptItems = []; renderReceipt(); showMessage('receiptMessage', 'Баримт зарлагаар хадгалагдлаа.'); } }

function authErrorMessage(error) { if (error.code === 'auth/configuration-not-found') return 'Firebase Console → Authentication → Get started хийгээд Google provider-ийг Enable болгоно уу.'; if (error.code === 'auth/unauthorized-domain') return 'Firebase Console → Authentication → Settings → Authorized domains-д tataki204.github.io нэмнэ үү.'; return `Нэвтэрч чадсангүй: ${error.message}`; }
async function signIn() {
  if (!firebaseConfigured) {
    showMessage('loginMessage', 'firebase.js дотор Firebase config-оо оруулна уу.');
    return;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const email = result.user.email?.toLowerCase();

    if (!email || !ALLOWED_EMAILS.includes(email)) {
      await signOut(auth);
      showMessage('loginMessage', 'Энэ хэрэглэгч зөвшөөрөгдсөн биш байна.');
      return;
    }

    showMessage('loginMessage', '');
  } catch (error) {
    showMessage('loginMessage', authErrorMessage(error));
  }
}
async function logOut() { try { await signOut(auth); } catch (error) { showMessage('sheetMessage', `Гарах үед алдаа гарлаа: ${error.message}`); } }
function showApp(user) { currentUser = user; byId('loginScreen').classList.add('hidden'); byId('financeApp').classList.remove('hidden'); setStatus(`${user.email || 'Google account'}-ийн санхүү`, true); loadTransactions(); }
function hideApp() { currentUser = null; editingId = null; transactions = []; receiptItems = []; render(); renderReceipt(); byId('financeApp').classList.add('hidden'); byId('loginScreen').classList.remove('hidden'); setStatus('Firestore-тэй холбогдоогүй'); }

byId('loginButton').addEventListener('click', signIn); byId('signOutButton').addEventListener('click', logOut); byId('refreshButton').addEventListener('click', loadTransactions); byId('monthFilter').addEventListener('change', render); byId('clearButton').addEventListener('click', clearTransactions); byId('cancelEditButton').addEventListener('click', resetTransactionForm);
document.querySelectorAll('.type-button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.type-button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); byId('transactionType').value = button.dataset.type; updateCategories(button.dataset.type); }));
byId('transactionForm').addEventListener('submit', async (event) => { event.preventDefault(); const item = { id: editingId || crypto.randomUUID(), type: byId('transactionType').value, amount: Number(byId('amount').value), category: byId('category').value, date: byId('date').value, note: byId('note').value.trim() }; if (editingId) { try { await updateTransaction(item); resetTransactionForm(); showMessage('formMessage', 'Гүйлгээ шинэчлэгдлээ.'); } catch (error) { showMessage('formMessage', `Шинэчилсэнгүй: ${error.message}`); } } else if (await saveTransaction(item)) resetTransactionForm(); });
byId('addReceiptItem').addEventListener('click', addReceiptItem); byId('saveReceiptButton').addEventListener('click', saveReceipt);
byId('date').valueAsDate = new Date(); byId('monthFilter').value = new Date().toISOString().slice(0, 7); updateCategories('income'); render(); renderReceipt();
if (firebaseConfigured) onAuthStateChanged(auth, (user) => user ? showApp(user) : hideApp()); else { setStatus('Firebase config оруулаагүй'); showMessage('loginMessage', 'firebase.js дотор Firebase config-оо оруулна уу.'); }
