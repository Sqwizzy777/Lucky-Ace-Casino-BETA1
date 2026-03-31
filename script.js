const STORAGE_KEY = 'lucky-ace-safe-casino-v2';
const BETS = [500, 1000, 2000, 5000, 10000];
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const SUPABASE_ENABLED = Boolean(window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey && window.SUPABASE_CONFIG.url !== 'PASTE_YOUR_SUPABASE_URL_HERE');
const supabaseClient = SUPABASE_ENABLED && window.supabase
  ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey)
  : null;

const SYMBOLS = {
  crown: { name: 'Корона', weight: 10, payouts: { 3: 20 }, color: '#f5c96c' },
  ace: { name: 'Ace', weight: 16, payouts: { 3: 10 }, color: '#9ec7ff' },
  king: { name: 'King', weight: 16, payouts: { 3: 8 }, color: '#c6b4ff' },
  seven: { name: 'Seven', weight: 14, payouts: { 3: 14 }, color: '#ff9a7c' },
  gem: { name: 'Gem', weight: 14, payouts: { 3: 12 }, color: '#61d39c' },
  wild: { name: 'Wild', weight: 6, payouts: { 3: 30 }, color: '#ffd98b' }
};
const PAYLINES = [[0,1,2],[3,4,5],[6,7,8]];

const defaultState = {
  user: null,
  balance: 0,
  slotBetIndex: 0,
  slotGrid: ['ace','king','seven','gem','crown','ace','king','wild','gem'],
  lastWin: 0,
  lastBet: BETS[0],
  lastCombo: '—',
  history: []
};

let state = loadState();
let slotSpinning = false;

const els = getElements();

function getElements() {
  return {
    authOverlay: document.getElementById('authOverlay'),
    appShell: document.getElementById('appShell'),
    authForm: document.getElementById('authForm'),
    authUsername: document.getElementById('authUsername'),
    authPassword: document.getElementById('authPassword'),
    registerBtn: document.getElementById('registerBtn'),
    loginBtn: document.getElementById('loginBtn'),
    menuToggle: document.getElementById('menuToggle'),
    mobileMenu: document.getElementById('mobileMenu'),
    walletBalance: document.getElementById('walletBalance'),
    heroBalance: document.getElementById('heroBalance'),
    slotBalance: document.getElementById('slotBalance'),
    profileName: document.getElementById('profileName'),
    playerTag: document.getElementById('playerTag'),
    heroLastWin: document.getElementById('heroLastWin'),
    heroLastBet: document.getElementById('heroLastBet'),
    betValue: document.getElementById('betValue'),
    lastWin: document.getElementById('lastWin'),
    lastCombo: document.getElementById('lastCombo'),
    slotStatus: document.getElementById('slotStatus'),
    reelGrid: document.getElementById('reelGrid'),
    resultsList: document.getElementById('resultsList'),
    historyList: document.getElementById('historyList'),
    paytable: document.getElementById('paytable'),
    betDown: document.getElementById('betDown'),
    betUp: document.getElementById('betUp'),
    maxBetBtn: document.getElementById('maxBetBtn'),
    spinBtn: document.getElementById('spinBtn'),
    historyBtn: document.getElementById('historyBtn'),
    mobileHistoryBtn: document.getElementById('mobileHistoryBtn'),
    depositBtn: document.getElementById('depositBtn'),
    mobileDepositBtn: document.getElementById('mobileDepositBtn'),
    withdrawBtn: document.getElementById('withdrawBtn'),
    mobileWithdrawBtn: document.getElementById('mobileWithdrawBtn'),
    footerWithdrawBtn: document.getElementById('footerWithdrawBtn'),
    historyModal: document.getElementById('historyModal'),
    depositModal: document.getElementById('depositModal'),
    withdrawModal: document.getElementById('withdrawModal'),
    toastStack: document.getElementById('toastStack'),
    rouletteWheel: document.getElementById('rouletteWheel'),
    rouletteNumbers: document.getElementById('rouletteNumbers'),
    rouletteBetType: document.getElementById('rouletteBetType'),
    rouletteNumberInput: document.getElementById('rouletteNumberInput'),
    rouletteBetAmount: document.getElementById('rouletteBetAmount'),
    rouletteSpinBtn: document.getElementById('rouletteSpinBtn'),
    rouletteResult: document.getElementById('rouletteResult'),
    rouletteWin: document.getElementById('rouletteWin'),
    rouletteStatus: document.getElementById('rouletteStatus'),
    dealerCards: document.getElementById('dealerCards'),
    communityCards: document.getElementById('communityCards'),
    playerCards: document.getElementById('playerCards'),
    texasBetAmount: document.getElementById('texasBetAmount'),
    dealTexasBtn: document.getElementById('dealTexasBtn'),
    playerHandRank: document.getElementById('playerHandRank'),
    dealerHandRank: document.getElementById('dealerHandRank'),
    texasStatus: document.getElementById('texasStatus'),
    texasPot: document.getElementById('texasPot'),
    texasProgress: document.getElementById('texasProgress')
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...structuredClone(defaultState), ...JSON.parse(raw) } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function euro(value) { return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value); }

function addToast(message, type='info') {
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = message;
  els.toastStack.appendChild(div);
  setTimeout(()=>{div.style.opacity='0';div.style.transform='translateY(8px)';},2500);
  setTimeout(()=>div.remove(),3000);
}

function ensureAuthView() {
  const authed = Boolean(state.user);
  els.authOverlay.style.display = authed ? 'none' : 'grid';
  els.appShell.classList.toggle('app-locked', !authed);
  els.appShell.setAttribute('aria-hidden', String(!authed));
}

function usernameToEmail(username) {
  return `${username.toLowerCase().replace(/[^a-z0-9_\-.]/g, '')}@luckyace.local`;
}

async function loadRemoteProfile() {
  if (!supabaseClient) return false;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.user) return false;
  const { data, error } = await supabaseClient.from('profiles').select('username,balance').eq('id', session.user.id).single();
  if (error || !data) return false;
  state.user = { username: data.username, id: session.user.id };
  state.balance = Number(data.balance ?? 1000);
  saveState();
  ensureAuthView();
  return true;
}

async function persistBalance() {
  if (!supabaseClient || !state.user?.id) return;
  const { error } = await supabaseClient.from('profiles').update({ balance: state.balance }).eq('id', state.user.id);
  if (error) console.error('Balance sync error', error);
}

async function register() {
  const username = els.authUsername.value.trim();
  const password = els.authPassword.value.trim();
  if (username.length < 3 || password.length < 4) {
    addToast('Перевір довжину юзернейму і пароля.', 'error');
    return;
  }

  if (!supabaseClient) {
    state.user = { username, password };
    state.balance = 1000;
    state.lastWin = 0;
    state.lastBet = BETS[state.slotBetIndex];
    state.history.unshift(logEntry('Реєстрація', 0, 'Стартовий бонус 1000 €'));
    saveState();
    ensureAuthView();
    updateAll();
    addToast('Локальна реєстрація завершена. Нараховано 1000 €.', 'success');
    return;
  }

  const email = usernameToEmail(username);
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });
  if (error) {
    addToast(error.message || 'Не вдалося зареєструватися.', 'error');
    return;
  }

  const user = data.user;
  if (!user) {
    addToast('Реєстрацію створено. Тепер увійди у свій акаунт.', 'info');
    return;
  }

  const { error: profileError } = await supabaseClient.from('profiles').upsert({
    id: user.id,
    username,
    balance: 1000
  });
  if (profileError) {
    addToast(profileError.message || 'Профіль не створено.', 'error');
    return;
  }

  state.user = { username, id: user.id };
  state.balance = 1000;
  state.lastWin = 0;
  state.lastBet = BETS[state.slotBetIndex];
  state.history.unshift(logEntry('Реєстрація', 0, 'Стартовий бонус 1000 €'));
  saveState();
  ensureAuthView();
  updateAll();
  addToast('Реєстрація через Supabase завершена.', 'success');
}

async function login() {
  const username = els.authUsername.value.trim();
  const password = els.authPassword.value.trim();

  if (!supabaseClient) {
    if (!state.user || state.user.username !== username || state.user.password !== password) {
      addToast('Невірний юзернейм або пароль.', 'error');
      return;
    }
    ensureAuthView();
    updateAll();
    addToast('Вхід виконано.', 'success');
    return;
  }

  const email = usernameToEmail(username);
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    addToast(error.message || 'Вхід не виконано.', 'error');
    return;
  }
  const loaded = await loadRemoteProfile();
  if (!loaded) {
    addToast('Сесія створена, але профіль не знайдено.', 'error');
    return;
  }
  updateAll();
  addToast('Вхід через Supabase виконано.', 'success');
}

function logEntry(game, delta, detail) {
  return {
    game,
    delta,
    detail,
    time: new Date().toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
  };
}

function updateHeader() {
  els.walletBalance.textContent = euro(state.balance);
  els.heroBalance.textContent = euro(state.balance);
  els.slotBalance.textContent = euro(state.balance);
  els.profileName.textContent = state.user?.username || '—';
  els.playerTag.textContent = state.user?.username || 'Гість';
  els.heroLastWin.textContent = euro(state.lastWin);
  els.heroLastBet.textContent = euro(state.lastBet);
  els.betValue.textContent = euro(BETS[state.slotBetIndex]);
  els.lastWin.textContent = euro(state.lastWin);
  els.lastCombo.textContent = state.lastCombo;
}

function renderHistory() {
  if (!state.history.length) {
    els.resultsList.innerHTML = '<li>Історія порожня.</li>';
    els.historyList.innerHTML = '<li>Історія порожня.</li>';
    return;
  }
  const latest = state.history.slice(0, 6);
  const template = item => `<li><div class="history-item"><div><strong>${item.game}</strong><div class="result-meta">${item.time} • ${item.detail}</div></div><span class="${item.delta >= 0 ? 'result-win' : 'result-loss'}">${item.delta > 0 ? '+' : ''}${euro(item.delta)}</span></div></li>`;
  els.resultsList.innerHTML = latest.map(template).join('');
  els.historyList.innerHTML = state.history.map(template).join('');
}

function renderPaytable() {
  const items = Object.entries(SYMBOLS).map(([key, symbol]) => `<div class="pay-row"><div class="pay-left"><span class="pay-icon">${glyph(key)}</span><strong>${symbol.name}</strong></div><span>x${symbol.payouts[3]}</span></div>`).join('');
  els.paytable.innerHTML = `<div class="paytable-wrap">${items}</div>`;
}

function glyph(key) {
  const color = SYMBOLS[key].color;
  const svg = {
    crown: `<svg class="symbol-glyph" viewBox="0 0 64 64"><path fill="${color}" d="M10 46h44l-4 10H14L10 46Zm2-24 11 10 9-18 9 18 11-10 2 22H10l2-22Z"/></svg>`,
    ace: `<svg class="symbol-glyph" viewBox="0 0 64 64"><path fill="${color}" d="M32 8 14 56h10l4-10h16l4 10h10L32 8Zm0 16 7 16H25l7-16Z"/></svg>`,
    king: `<svg class="symbol-glyph" viewBox="0 0 64 64"><path fill="${color}" d="M18 54V12h10v15l10-9 8 9V12h10v42H46V38l-8 7-10-7v16H18Z"/></svg>`,
    seven: `<svg class="symbol-glyph" viewBox="0 0 64 64"><path fill="${color}" d="M14 14h36v8L32 54H20l16-30H14v-10Z"/></svg>`,
    gem: `<svg class="symbol-glyph" viewBox="0 0 64 64"><path fill="${color}" d="m18 16 8-8h12l8 8-14 40L18 16Zm3 2 11 30 11-30H21Z"/></svg>`,
    wild: `<svg class="symbol-glyph" viewBox="0 0 64 64"><path fill="${color}" d="M32 6 38 24h18L41 35l6 19-15-11-15 11 6-19L8 24h18l6-18Z"/></svg>`
  };
  return svg[key];
}

function weightedSymbol() {
  const entries = Object.entries(SYMBOLS);
  const total = entries.reduce((a,[,v]) => a + v.weight, 0);
  let rand = Math.random() * total;
  for (const [key, value] of entries) { rand -= value.weight; if (rand <= 0) return key; }
  return 'ace';
}
function generateSlotGrid() { return Array.from({length: 9}, weightedSymbol); }

function renderSlotGrid() {
  els.reelGrid.innerHTML = state.slotGrid.map((key, i) => `<div class="reel-cell" data-index="${i}"><div class="symbol-card">${glyph(key)}</div><span class="symbol-label">${SYMBOLS[key].name}</span></div>`).join('');
}

function clearSlotHighlights() {
  document.querySelectorAll('.reel-cell').forEach(el => el.classList.remove('winning','spinning'));
  document.querySelectorAll('.payline').forEach(el => el.classList.remove('active'));
}

function evaluateSlotLine(keys, bet) {
  const nonWild = keys.filter(k => k !== 'wild');
  const base = nonWild[0] || 'wild';
  const ok = keys.every(k => k === base || k === 'wild');
  if (!ok) return { win: 0, combo: null };
  return { win: bet * (SYMBOLS[base].payouts[3] || 0), combo: `${SYMBOLS[base].name} x3` };
}
function evaluateSlotGrid(grid, bet) {
  let total = 0; const winners = []; const paylines=[]; const combos=[];
  PAYLINES.forEach((line, idx) => {
    const result = evaluateSlotLine(line.map(i => grid[i]), bet);
    if (result.win > 0) { total += result.win; winners.push(...line); paylines.push(idx+1); combos.push(result.combo); }
  });
  return { total, winners: [...new Set(winners)], paylines, combos };
}

async function spinSlots() {
  if (!state.user || slotSpinning) return;
  const bet = BETS[state.slotBetIndex];
  if (state.balance < bet) return addToast('Недостатньо коштів для ставки.', 'error');
  slotSpinning = true; clearSlotHighlights();
  state.balance -= bet; state.lastBet = bet; state.lastWin = 0; state.lastCombo = '—';
  updateHeader(); saveState();
  els.slotStatus.textContent = 'Барабани обертаються…';
  for (let i = 0; i < 9; i++) document.querySelector(`.reel-cell[data-index="${i}"]`)?.classList.add('spinning');
  for (let step = 0; step < 8; step++) {
    state.slotGrid = generateSlotGrid(); renderSlotGrid();
    document.querySelectorAll('.reel-cell').forEach(el => el.classList.add('spinning'));
    await new Promise(r => setTimeout(r, 90 + step * 12));
  }
  state.slotGrid = generateSlotGrid(); renderSlotGrid();
  const result = evaluateSlotGrid(state.slotGrid, bet);
  state.balance += result.total; state.lastWin = result.total; state.lastCombo = result.combos.length ? result.combos.join(' • ') : 'Без виграшу';
  if (result.total > 0) {
    result.winners.forEach(i => document.querySelector(`.reel-cell[data-index="${i}"]`)?.classList.add('winning'));
    result.paylines.forEach(i => document.querySelector(`.payline-${i}`)?.classList.add('active'));
    els.slotStatus.textContent = `Виграш ${euro(result.total)}`;
  } else {
    els.slotStatus.textContent = 'Без виграшу';
  }
  state.history.unshift(logEntry('Слоти', result.total - bet, `${state.lastCombo}; ставка ${euro(bet)}`));
  state.history = state.history.slice(0, 24);
  slotSpinning = false;
  saveState(); updateAll();
  persistBalance();
}

function fillBetSelect(select) {
  select.innerHTML = BETS.map(v => `<option value="${v}">${euro(v)}</option>`).join('');
  select.value = BETS[0];
}
function renderRouletteBoard() {
  const pills = [0, 7, 13, 21, 32, 36];
  els.rouletteWheel.innerHTML = pills.map(n => `<span class="wheel-pill" data-pill="${n}">${n}</span>`).join('');
  els.rouletteNumbers.innerHTML = Array.from({length: 37}, (_,i) => {
    const cls = i === 0 ? 'green' : RED_NUMBERS.has(i) ? 'red' : 'black';
    return `<button type="button" class="roulette-number ${cls}" data-number="${i}">${i}</button>`;
  }).join('');
}

async function rouletteSpin() {
  if (!state.user) return;
  const bet = Number(els.rouletteBetAmount.value);
  if (state.balance < bet) return addToast('Недостатньо коштів для рулетки.', 'error');
  const type = els.rouletteBetType.value;
  const chosen = Number(els.rouletteNumberInput.value);
  const result = Math.floor(Math.random() * 37);
  state.balance -= bet;
  updateHeader();
  els.rouletteStatus.textContent = 'Колесо крутиться…';
  const wheelTargets = [...document.querySelectorAll('.wheel-pill')];
  const numberTargets = [...document.querySelectorAll('.roulette-number')];
  for (let i = 0; i < 18; i++) {
    const wheel = wheelTargets[i % wheelTargets.length];
    const cell = numberTargets[i % numberTargets.length];
    wheelTargets.forEach(x => x.classList.remove('active'));
    numberTargets.forEach(x => x.classList.remove('active'));
    wheel?.classList.add('active');
    cell?.classList.add('active');
    await new Promise(r => setTimeout(r, 55 + i * 6));
  }
  let win = 0;
  const red = RED_NUMBERS.has(result);
  const black = result !== 0 && !red;
  if (type === 'red' && red) win = bet * 2;
  if (type === 'black' && black) win = bet * 2;
  if (type === 'even' && result !== 0 && result % 2 === 0) win = bet * 2;
  if (type === 'odd' && result % 2 === 1) win = bet * 2;
  if (type === 'low' && result >= 1 && result <= 18) win = bet * 2;
  if (type === 'high' && result >= 19 && result <= 36) win = bet * 2;
  if (type === 'number' && result === chosen) win = bet * 36;
  state.balance += win; state.lastBet = bet; state.lastWin = Math.max(0, win - bet);
  els.rouletteResult.textContent = String(result);
  els.rouletteWin.textContent = euro(Math.max(0, win - bet));
  els.rouletteStatus.textContent = win > 0 ? 'Ставка зайшла' : 'Без виграшу';
  wheelTargets.forEach(x => x.classList.toggle('active', Number(x.dataset.pill) === result));
  numberTargets.forEach(btn => btn.classList.toggle('active', Number(btn.dataset.number) === result));
  if (win > 0) { els.rouletteStatus.classList.add('pulse-win'); setTimeout(() => els.rouletteStatus.classList.remove('pulse-win'), 900); }
  state.history.unshift(logEntry('Roulette Noir', win - bet, `Результат ${result}; ставка ${euro(bet)}`));
  state.history = state.history.slice(0, 24);
  saveState(); updateAll();
  persistBalance();
}

function createDeck() {
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];
  for (const suit of suits) for (const rank of ranks) deck.push({ suit, rank, value: ranks.indexOf(rank) + 2 });
  return deck.sort(() => Math.random() - 0.5);
}
function renderCards(container, cards) {
  container.innerHTML = cards.map(c => `<div class="playing-card ${c.suit === '♥' || c.suit === '♦' ? 'red-card' : ''}"><span>${c.rank}</span><small>${c.suit}</small></div>`).join('');
}
function countBy(arr, fn) { return arr.reduce((m, x) => ((m[fn(x)] = (m[fn(x)] || 0) + 1), m), {}); }
function evaluateSeven(cards) {
  const values = cards.map(c => c.value).sort((a,b)=>b-a);
  const counts = Object.values(countBy(cards, c => c.rank)).sort((a,b)=>b-a);
  const bySuit = countBy(cards, c => c.suit);
  const flushSuit = Object.keys(bySuit).find(s => bySuit[s] >= 5);
  const uniq = [...new Set(values)].sort((a,b)=>b-a);
  if (uniq[0] === 14) uniq.push(1);
  let straightHigh = 0;
  for (let i=0;i<=uniq.length-5;i++) if (uniq[i]-1===uniq[i+1] && uniq[i+1]-1===uniq[i+2] && uniq[i+2]-1===uniq[i+3] && uniq[i+3]-1===uniq[i+4]) { straightHigh = uniq[i]; break; }
  const flushCards = flushSuit ? cards.filter(c => c.suit === flushSuit).sort((a,b)=>b.value-a.value) : [];
  const flushUniq = [...new Set(flushCards.map(c=>c.value))]; if (flushUniq[0]===14) flushUniq.push(1);
  let straightFlushHigh = 0;
  for (let i=0;i<=flushUniq.length-5;i++) if (flushUniq[i]-1===flushUniq[i+1] && flushUniq[i+1]-1===flushUniq[i+2] && flushUniq[i+2]-1===flushUniq[i+3] && flushUniq[i+3]-1===flushUniq[i+4]) { straightFlushHigh = flushUniq[i]; break; }
  const rankCounts = countBy(cards, c => c.value);
  const pairs = Object.entries(rankCounts).filter(([,n])=>n===2).map(([v])=>Number(v)).sort((a,b)=>b-a);
  const trips = Object.entries(rankCounts).filter(([,n])=>n===3).map(([v])=>Number(v)).sort((a,b)=>b-a);
  const fours = Object.entries(rankCounts).filter(([,n])=>n===4).map(([v])=>Number(v)).sort((a,b)=>b-a);

  if (straightFlushHigh) return { rank: 9, label: 'Straight Flush', score: 900 + straightFlushHigh };
  if (fours.length) return { rank: 8, label: 'Four of a Kind', score: 800 + fours[0] };
  if (trips.length && (pairs.length || trips.length > 1)) return { rank: 7, label: 'Full House', score: 700 + trips[0] };
  if (flushSuit) return { rank: 6, label: 'Flush', score: 600 + flushCards[0].value };
  if (straightHigh) return { rank: 5, label: 'Straight', score: 500 + straightHigh };
  if (trips.length) return { rank: 4, label: 'Three of a Kind', score: 400 + trips[0] };
  if (pairs.length >= 2) return { rank: 3, label: 'Two Pair', score: 300 + pairs[0] * 2 + pairs[1] };
  if (pairs.length === 1) return { rank: 2, label: 'Pair', score: 200 + pairs[0] };
  return { rank: 1, label: `High Card ${valueToRank(values[0])}`, score: 100 + values[0] };
}
function valueToRank(v) { return ({14:'A',13:'K',12:'Q',11:'J'})[v] || String(v); }
async function dealTexas() {
  if (!state.user) return;
  const bet = Number(els.texasBetAmount.value);
  if (state.balance < bet) return addToast('Недостатньо коштів для Texas Roll\'em.', 'error');
  const deck = createDeck();
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];
  const board = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
  state.balance -= bet;
  state.lastBet = bet;
  updateHeader();
  els.texasPot.textContent = euro(bet * 2);
  const steps = [...els.texasProgress.querySelectorAll('.texas-step')];
  const mark = idx => steps.forEach((s,i) => s.classList.toggle('active', i <= idx));
  mark(0);
  els.texasStatus.textContent = 'Роздача…';
  renderCards(els.playerCards, player);
  renderCards(els.dealerCards, [{rank:'?', suit:'?'}, {rank:'?', suit:'?'}]);
  renderCards(els.communityCards, []);
  await new Promise(r => setTimeout(r, 450));
  mark(1); els.texasStatus.textContent = 'Flop';
  renderCards(els.communityCards, board.slice(0,3));
  await new Promise(r => setTimeout(r, 500));
  mark(2); els.texasStatus.textContent = 'Turn';
  renderCards(els.communityCards, board.slice(0,4));
  await new Promise(r => setTimeout(r, 500));
  mark(3); els.texasStatus.textContent = 'River';
  renderCards(els.communityCards, board.slice(0,5));
  await new Promise(r => setTimeout(r, 550));
  mark(4); els.texasStatus.textContent = 'Showdown';
  renderCards(els.dealerCards, dealer);
  const pEval = evaluateSeven([...player, ...board]);
  const dEval = evaluateSeven([...dealer, ...board]);
  let delta = -bet;
  let status = 'Дилер виграв';
  if (pEval.score > dEval.score) { state.balance += bet * 2; delta = bet; status = 'Ти виграв'; }
  else if (pEval.score === dEval.score) { state.balance += bet; delta = 0; status = 'Нічия'; }
  state.lastWin = Math.max(0, delta);
  els.playerHandRank.textContent = pEval.label;
  els.dealerHandRank.textContent = dEval.label;
  els.texasStatus.textContent = status;
  if (delta > 0) { els.texasStatus.classList.add('pulse-win'); setTimeout(() => els.texasStatus.classList.remove('pulse-win'), 900); }
  state.history.unshift(logEntry('Texas Roll\'em', delta, `${pEval.label} vs ${dEval.label}; ставка ${euro(bet)}`));
  state.history = state.history.slice(0,24);
  saveState(); updateAll();
  persistBalance();
}

function updateAll() {
  updateHeader(); renderHistory(); renderSlotGrid(); renderPaytable();
}

function bind() {
  els.authForm?.addEventListener('submit', e => { e.preventDefault(); register(); });
  els.loginBtn?.addEventListener('click', login);
  els.menuToggle?.addEventListener('click', () => {
    const expanded = els.menuToggle.getAttribute('aria-expanded') === 'true';
    els.menuToggle.setAttribute('aria-expanded', String(!expanded));
    els.mobileMenu.hidden = expanded;
  });
  els.betDown?.addEventListener('click', () => { state.slotBetIndex = Math.max(0, state.slotBetIndex - 1); saveState(); updateHeader(); });
  els.betUp?.addEventListener('click', () => { state.slotBetIndex = Math.min(BETS.length - 1, state.slotBetIndex + 1); saveState(); updateHeader(); });
  els.maxBetBtn?.addEventListener('click', () => { state.slotBetIndex = BETS.length - 1; saveState(); updateHeader(); });
  els.spinBtn?.addEventListener('click', spinSlots);
  els.rouletteSpinBtn?.addEventListener('click', rouletteSpin);
  els.dealTexasBtn?.addEventListener('click', dealTexas);
  [els.historyBtn, els.mobileHistoryBtn].forEach(btn => btn?.addEventListener('click', ()=> els.historyModal.showModal()));
  [els.depositBtn, els.mobileDepositBtn].forEach(btn => btn?.addEventListener('click', ()=> els.depositModal.showModal()));
  [els.withdrawBtn, els.mobileWithdrawBtn, els.footerWithdrawBtn].forEach(btn => btn?.addEventListener('click', ()=> els.withdrawModal.showModal()));
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => document.getElementById(btn.dataset.close)?.close()));
  document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', e => {
    const card = modal.querySelector('.modal-card').getBoundingClientRect();
    if (!(e.clientX >= card.left && e.clientX <= card.right && e.clientY >= card.top && e.clientY <= card.bottom)) modal.close();
  }));
  els.rouletteNumbers?.addEventListener('click', e => {
    const btn = e.target.closest('.roulette-number');
    if (!btn) return;
    els.rouletteBetType.value = 'number';
    els.rouletteNumberInput.value = btn.dataset.number;
  });
}

async function init() {
  fillBetSelect(els.rouletteBetAmount);
  fillBetSelect(els.texasBetAmount);
  renderRouletteBoard();
  renderCards(els.playerCards, []); renderCards(els.dealerCards, []); renderCards(els.communityCards, []);
  if (supabaseClient) {
    await loadRemoteProfile();
  }
  ensureAuthView();
  updateAll();
  bind();
}

init();
