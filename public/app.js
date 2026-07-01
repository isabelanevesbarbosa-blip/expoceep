const state = {
  page: 'login',
  token: localStorage.getItem('gamehub_token') || '',
  user: JSON.parse(localStorage.getItem('gamehub_user') || 'null'),
  games: [],
  currentGame: null,
  rankings: [],
  history: [],
  status: '',
  lastScore: null
};

const view = document.getElementById('view');
const userBar = document.getElementById('userBar');

function saveSession(user, token) {
  state.user = user;
  state.token = token;
  localStorage.setItem('gamehub_user', JSON.stringify(user));
  localStorage.setItem('gamehub_token', token);
}

function clearSession() {
  state.user = null;
  state.token = '';
  localStorage.removeItem('gamehub_user');
  localStorage.removeItem('gamehub_token');
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  if (!headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Erro inesperado');
  }

  return data;
}

async function loadGames() {
  const data = await api('/api/games');
  state.games = data.games;
}

async function loadRankings() {
  const data = await api('/api/ranking');
  state.rankings = data.rankings;
}

async function loadHistory() {
  if (!state.token) return;
  const data = await api('/api/history');
  state.history = data.history;
}

async function verifySession() {
  if (!state.token) {
    state.page = 'login';
    render();
    return;
  }

  try {
    const data = await api('/api/me');
    state.user = data.user;
    state.page = 'home';
    render();
  } catch {
    clearSession();
    state.page = 'login';
    render();
  }
}

function setStatus(message) {
  state.status = message;
  render();
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password')
      })
    });
    saveSession(data.user, data.token);
    state.page = 'home';
    await loadGames();
    await loadRankings();
    await loadHistory();
    render();
  } catch (error) {
    setStatus(error.message);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password')
      })
    });
    saveSession(data.user, data.token);
    state.page = 'home';
    await loadGames();
    await loadRankings();
    await loadHistory();
    render();
  } catch (error) {
    setStatus(error.message);
  }
}

async function submitScore(score) {
  try {
    const data = await api('/api/score', {
      method: 'POST',
      body: JSON.stringify({ gameId: state.currentGame, score })
    });
    state.lastScore = data.score;
    state.status = `Pontuação salva: ${data.score.score} pontos para ${data.score.gameName}`;
    await loadRankings();
    await loadHistory();
    render();
  } catch (error) {
    state.status = error.message;
    render();
  }
}

function renderUserBar() {
  if (!state.user) {
    userBar.innerHTML = '';
    return;
  }

  userBar.innerHTML = `
    <div class="panel" style="padding: 10px 14px; display: flex; gap: 10px; align-items: center;">
      <span style="font-size: 1.3rem;">${state.user.avatar}</span>
      <div>
        <strong>${state.user.name}</strong>
        <div class="muted">${state.user.email}</div>
      </div>
      <button class="secondary" id="logoutBtn">Sair</button>
    </div>
  `;

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession();
    state.page = 'login';
    state.status = 'Sessão encerrada.';
    render();
  });
}

function renderLoginPage() {
  view.innerHTML = `
    <section class="auth-grid">
      <div class="card">
        <h2>Entrar</h2>
        <p style="margin: 8px 0 12px; color: var(--muted);">Acesse sua conta para jogar e ver o ranking.</p>
        <form id="loginForm">
          <input name="email" type="email" placeholder="E-mail" required />
          <input name="password" type="password" placeholder="Senha" required />
          <button type="submit">Entrar</button>
        </form>
      </div>
      <div class="card">
        <h2>Criar conta</h2>
        <p style="margin: 8px 0 12px; color: var(--muted);">Cadastre-se para salvar suas pontuações.</p>
        <form id="registerForm">
          <input name="name" type="text" placeholder="Seu nome" required />
          <input name="email" type="email" placeholder="E-mail" required />
          <input name="password" type="password" placeholder="Senha" required />
          <button type="submit">Registrar</button>
        </form>
      </div>
    </section>
    ${state.status ? `<p class="status">${state.status}</p>` : ''}
  `;

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
}

function renderHomePage() {
  view.innerHTML = `
    <section class="card">
      <h2>Bem-vindo, ${state.user?.name || 'jogador'}!</h2>
      <p style="margin-top: 8px; color: var(--muted);">Escolha um jogo e comece a competir.</p>
      <div class="games-grid">
        ${state.games.map((game) => `
          <article class="game-card card">
            <span class="badge">${game.id === 'memory' ? 'Memória' : 'Cliques'}</span>
            <h3>${game.name}</h3>
            <p style="color: var(--muted);">${game.description}</p>
            <p style="font-size: 0.95rem;">${game.rules}</p>
            <div style="display:flex; gap: 8px; margin-top: auto;">
              <button data-game="${game.id}" class="playBtn">Jogar</button>
              <button data-ranking="${game.id}" class="secondary rankingBtn">Ranking</button>
            </div>
          </article>
        `).join('')}
      </div>
      <div style="display:flex; gap: 10px; margin-top: 16px;">
        <button class="secondary" id="rankingBtn">Ver ranking geral</button>
        <button class="secondary" id="historyBtn">Meu histórico</button>
      </div>
      ${state.status ? `<p class="status">${state.status}</p>` : ''}
    </section>
  `;

  document.querySelectorAll('.playBtn').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentGame = button.getAttribute('data-game');
      state.page = 'game';
      render();
    });
  });

  document.querySelectorAll('.rankingBtn').forEach((button) => {
    button.addEventListener('click', async () => {
      state.currentGame = button.getAttribute('data-ranking');
      state.page = 'ranking';
      await loadRankings();
      render();
    });
  });

  document.getElementById('rankingBtn')?.addEventListener('click', async () => {
    state.page = 'ranking';
    await loadRankings();
    render();
  });

  document.getElementById('historyBtn')?.addEventListener('click', async () => {
    await loadHistory();
    state.page = 'history';
    render();
  });
}

function renderRankingPage() {
  const selectedGame = state.rankings.find((entry) => entry.gameId === state.currentGame);
  view.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap;">
        <div>
          <h2>Ranking</h2>
          <p style="color: var(--muted); margin-top: 6px;">Veja os melhores resultados por jogo.</p>
        </div>
        <button class="secondary" id="backHomeBtn">Voltar</button>
      </div>
      ${state.rankings.map((entry) => `
        <div class="panel" style="margin-top: 14px;">
          <h3>${entry.game}</h3>
          <div class="list">
            ${entry.ranking.length ? entry.ranking.map((item, index) => `
              <div class="list-item">
                <span>#${index + 1} ${item.user}</span>
                <strong>${item.score} pts</strong>
              </div>
            `).join('') : '<p style="color: var(--muted);">Ainda não há pontuações.</p>'}
          </div>
        </div>
      `).join('')}
      ${selectedGame ? `<div style="margin-top: 14px; color: var(--muted);">Exibindo detalhes para ${selectedGame.game}</div>` : ''}
      ${state.status ? `<p class="status">${state.status}</p>` : ''}
    </section>
  `;

  document.getElementById('backHomeBtn').addEventListener('click', () => {
    state.page = 'home';
    render();
  });
}

function renderHistoryPage() {
  view.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap;">
        <div>
          <h2>Meu histórico</h2>
          <p style="color: var(--muted); margin-top: 6px;">Suas últimas partidas salvas.</p>
        </div>
        <button class="secondary" id="backHomeBtn">Voltar</button>
      </div>
      <div class="list">
        ${state.history.length ? state.history.map((entry) => `
          <div class="list-item">
            <span>${entry.game}</span>
            <strong>${entry.score} pts</strong>
          </div>
        `).join('') : '<p style="color: var(--muted);">Você ainda não registrou nenhuma pontuação.</p>'}
      </div>
      ${state.status ? `<p class="status">${state.status}</p>` : ''}
    </section>
  `;

  document.getElementById('backHomeBtn').addEventListener('click', () => {
    state.page = 'home';
    render();
  });
}

function startMemoryGame() {
  const gameRoot = document.getElementById('gameRoot');
  const emojis = ['🍎', '🍌', '🍒', '🍓', '🍇', '🥝', '🍉', '🍋'];
  const cards = [...emojis, ...emojis]
    .map((emoji, index) => ({ emoji, id: index }))
    .sort(() => Math.random() - 0.5);

  let flipped = [];
  let matched = 0;
  let moves = 0;
  let locked = false;

  function renderBoard() {
    gameRoot.innerHTML = `
      <div class="memory-board">
        ${cards.map((card, index) => `
          <button class="memory-card ${card.revealed || card.matched ? 'revealed' : ''} ${card.matched ? 'matched' : ''}" data-index="${index}">
            ${card.revealed || card.matched ? card.emoji : '?'}
          </button>
        `).join('')}
      </div>
      <p style="margin-top: 12px; color: var(--muted);">Jogadas: ${moves}</p>
    `;

    gameRoot.querySelectorAll('.memory-card').forEach((button) => {
      button.addEventListener('click', () => handleCardClick(Number(button.getAttribute('data-index'))));
    });
  }

  function handleCardClick(index) {
    const card = cards[index];
    if (locked || card.matched || card.revealed) return;

    card.revealed = true;
    flipped.push(index);
    moves += 1;
    renderBoard();

    if (flipped.length !== 2) return;

    locked = true;
    const [firstIndex, secondIndex] = flipped;
    const firstCard = cards[firstIndex];
    const secondCard = cards[secondIndex];

    if (firstCard.emoji === secondCard.emoji) {
      firstCard.matched = true;
      secondCard.matched = true;
      matched += 1;
      flipped = [];
      locked = false;
      if (matched === emojis.length) {
        const score = Math.max(200, 1000 - moves * 18);
        submitScore(score);
      } else {
        renderBoard();
      }
      return;
    }

    setTimeout(() => {
      firstCard.revealed = false;
      secondCard.revealed = false;
      flipped = [];
      locked = false;
      renderBoard();
    }, 800);
  }

  renderBoard();
}

function startClickerGame() {
  const gameRoot = document.getElementById('gameRoot');
  let clicks = 0;
  let timeLeft = 15;
  let finished = false;

  gameRoot.innerHTML = `
    <div class="clicker-area">
      <h3>Tempo restante: <span id="timer">15</span>s</h3>
      <p style="color: var(--muted);">Aperte o botão o máximo que puder antes do tempo acabar.</p>
      <button class="clicker-btn" id="clickBtn">Clique aqui!</button>
      <p>Cliques: <strong id="counter">0</strong></p>
    </div>
  `;

  const timerLabel = document.getElementById('timer');
  const counter = document.getElementById('counter');
  const clickBtn = document.getElementById('clickBtn');

  const interval = setInterval(() => {
    timeLeft -= 1;
    timerLabel.textContent = String(timeLeft);
    if (timeLeft <= 0 && !finished) {
      finished = true;
      clearInterval(interval);
      const score = clicks * 10;
      clickBtn.disabled = true;
      submitScore(score);
    }
  }, 1000);

  clickBtn.addEventListener('click', () => {
    if (finished) return;
    clicks += 1;
    counter.textContent = String(clicks);
  });
}

function renderGamePage() {
  const game = state.games.find((item) => item.id === state.currentGame);
  view.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap;">
        <div>
          <h2>${game ? game.name : 'Jogo'}</h2>
          <p style="color: var(--muted); margin-top: 6px;">${game ? game.rules : 'Selecione um jogo.'}</p>
        </div>
        <button class="secondary" id="backHomeBtn">Voltar</button>
      </div>
      <div id="gameRoot"></div>
      ${state.status ? `<p class="status">${state.status}</p>` : ''}
    </section>
  `;

  document.getElementById('backHomeBtn').addEventListener('click', () => {
    state.page = 'home';
    render();
  });

  if (game?.id === 'memory') {
    startMemoryGame();
  } else if (game?.id === 'clicker') {
    startClickerGame();
  }
}

function render() {
  renderUserBar();

  if (!state.user) {
    renderLoginPage();
    return;
  }

  if (state.page === 'home') {
    renderHomePage();
  } else if (state.page === 'game') {
    renderGamePage();
  } else if (state.page === 'ranking') {
    renderRankingPage();
  } else if (state.page === 'history') {
    renderHistoryPage();
  } else {
    renderHomePage();
  }
}

(async function init() {
  try {
    await loadGames();
    await loadRankings();
    await verifySession();
  } catch (error) {
    state.status = error.message;
    render();
  }
})();
