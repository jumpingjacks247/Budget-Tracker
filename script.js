const STORAGE_KEY = 'jarguard-budget-state';

const state = {
  allowance: 0,
  purchases: [],
  pendingPurchase: null
};

const $ = (selector) => document.querySelector(selector);
const allowanceInput = $('#allowanceInput');
const purchaseInput = $('#purchaseInput');
const amountInput = $('#amountInput');
const budgetInput = $('#budgetInput');
const allowanceForm = $('#allowanceForm');
const spendForm = $('#spendForm');
const budgetModal = $('#budgetModal');
const savingsModal = $('#savingsModal');
const toast = $('#toast');

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.allowance === 'number' && Array.isArray(saved.purchases)) {
      state.allowance = saved.allowance;
      state.purchases = saved.purchases;
    }
  } catch (error) {
    // A fresh tracker is still usable if storage is unavailable or corrupted.
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    allowance: state.allowance,
    purchases: state.purchases
  }));
}

function money(value) {
  return `$${Number(value).toFixed(2)}`;
}

function totalSpent() {
  return state.purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
}

function render() {
  const spent = totalSpent();
  const remaining = Math.max(state.allowance - spent, 0);
  const percentRemaining = state.allowance > 0 ? Math.round((remaining / state.allowance) * 100) : 0;
  const percentSpent = state.allowance > 0 ? Math.min(Math.round((spent / state.allowance) * 100), 100) : 0;

  $('#balanceAmount').textContent = money(remaining);
  $('#allowanceStat').textContent = money(remaining);
  $('#allowanceNote').textContent = state.allowance > 0 ? `From ${money(state.allowance)} allowance` : 'Set an allowance to begin';
  $('#spentStat').textContent = money(spent);
  $('#balancePercent').textContent = `${percentRemaining}% left`;
  $('#spentMessage').textContent = state.allowance > 0 ? `${percentSpent}% of allowance used` : 'Set an allowance to get started';
  $('#balanceBarFill').style.width = `${percentRemaining}%`;
  $('#balanceBarFill').style.background = percentRemaining < 25 ? '#ffc0ab' : '#a7e4b9';
  renderJarGraph(remaining, percentRemaining, spent);

  $('#purchaseCount').textContent = `${state.purchases.length} ${state.purchases.length === 1 ? 'purchase' : 'purchases'}`;
  renderPurchases();
  $('#formHelper').textContent = state.allowance > 0
    ? 'You can change your allowance anytime. Small pauses make big goals possible.'
    : 'Set an allowance first, then log your spending.';
}

function renderJarGraph(remaining, percentRemaining, spent) {
  const hasMoney = state.allowance > 0 && percentRemaining > 0;
  $('.jar-graph').classList.toggle('is-empty', percentRemaining <= 0);
  $('#jarGraphFill').hidden = !hasMoney;
  $('#jarGraphFill').style.height = `${percentRemaining}%`;
  $('#jarGraphPercent').textContent = `${percentRemaining}%`;
  $('#jarGraphAmount').textContent = money(remaining);
  $('#jarGraphMessage').textContent = state.allowance > 0
    ? `${money(spent)} spent — your jar has ${percentRemaining}% left.`
    : 'Set an allowance to fill your jar.';
}

function renderPurchases() {
  const list = $('#purchaseList');
  const emptyState = $('#emptyState');
  list.querySelectorAll('.purchase-item').forEach((item) => item.remove());
  emptyState.hidden = state.purchases.length > 0;

  [...state.purchases].reverse().forEach((purchase) => {
    const item = document.createElement('article');
    item.className = 'purchase-item';
    item.innerHTML = `
      <div class="purchase-left">
        <div class="purchase-icon" aria-hidden="true">✦</div>
        <div>
          <p class="purchase-name"></p>
          <p class="purchase-date">${purchase.date}</p>
        </div>
      </div>
      <div class="purchase-right">
        <span class="budget-tag">${money(purchase.budget)} budget</span>
        <span class="purchase-amount">−${money(purchase.amount)}</span>
        <button class="delete-purchase" type="button" data-id="${purchase.id}" aria-label="Remove ${purchase.name}">×</button>
      </div>`;
    item.querySelector('.purchase-name').textContent = purchase.name;
    list.appendChild(item);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function openBudgetWarning(purchase) {
  state.pendingPurchase = purchase;
  $('#modalMessage').textContent = `${money(purchase.amount)} is more than the ${money(purchase.budget)} budget you set. Continue anyway?`;
  budgetModal.hidden = false;
  $('#confirmPurchase').focus();
}

function closeBudgetWarning() {
  budgetModal.hidden = true;
  state.pendingPurchase = null;
}

function openSavingsGraph() {
  savingsModal.hidden = false;
  render();
  $('#savingsModalClose').focus();
}

function closeSavingsGraph() {
  savingsModal.hidden = true;
}

function addPurchase(purchase) {
  state.purchases.push(purchase);
  saveState();
  render();
  spendForm.reset();
  closeBudgetWarning();
  showToast(`${purchase.name} added. Nice job staying aware!`);
}

allowanceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const amount = Number(allowanceInput.value);
  if (Number.isNaN(amount) || amount < 0) return;
  state.allowance = amount;
  saveState();
  render();
  showToast('Allowance saved. You are ready to make a plan!');
});

document.querySelectorAll('.preset-button').forEach((button) => {
  button.addEventListener('click', () => {
    allowanceInput.value = button.dataset.allowance;
    document.querySelectorAll('.preset-button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
  });
});

spendForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = purchaseInput.value.trim();
  const amount = Number(amountInput.value);
  const budget = Number(budgetInput.value);

  if (!state.allowance) {
    showToast('Set your allowance before logging a purchase.');
    allowanceInput.focus();
    return;
  }
  if (!name || Number.isNaN(amount) || amount <= 0) return;

  const purchase = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    amount,
    budget,
    date: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())
  };

  if (amount > budget) {
    openBudgetWarning(purchase);
  } else {
    addPurchase(purchase);
  }
});

$('#confirmPurchase').addEventListener('click', () => {
  if (state.pendingPurchase) addPurchase(state.pendingPurchase);
});
$('#cancelPurchase').addEventListener('click', closeBudgetWarning);
$('#modalClose').addEventListener('click', closeBudgetWarning);
budgetModal.addEventListener('click', (event) => {
  if (event.target === budgetModal) closeBudgetWarning();
});
$('#jarGraphButton').addEventListener('click', openSavingsGraph);
$('#savingsModalClose').addEventListener('click', closeSavingsGraph);
savingsModal.addEventListener('click', (event) => {
  if (event.target === savingsModal) closeSavingsGraph();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!budgetModal.hidden) closeBudgetWarning();
  if (!savingsModal.hidden) closeSavingsGraph();
});

$('#purchaseList').addEventListener('click', (event) => {
  const button = event.target.closest('.delete-purchase');
  if (!button) return;
  state.purchases = state.purchases.filter((purchase) => purchase.id !== button.dataset.id);
  saveState();
  render();
  showToast('Purchase removed. Your balance is back on track.');
});

$('#resetButton').addEventListener('click', () => {
  if (!state.allowance && state.purchases.length === 0) {
    showToast('Your tracker is already fresh.');
    return;
  }
  state.allowance = 0;
  state.purchases = [];
  allowanceInput.value = '';
  saveState();
  render();
  showToast('Fresh start! Set a new allowance when you are ready.');
});

$('#startButton').addEventListener('click', () => {
  $('#tracker').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => allowanceInput.focus(), 550);
});

loadState();
if (state.allowance > 0) allowanceInput.value = state.allowance;
render();
