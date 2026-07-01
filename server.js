const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, 'data');
const usersFile = path.join(dataDir, 'users.json');
const scoresFile = path.join(dataDir, 'scores.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadJSON(file, fallback) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const users = loadJSON(usersFile, {});
const scores = loadJSON(scoresFile, []);
const sessions = {};

const games = [
  {
    id: 'memory',
    name: 'Jogo da Memória',
    description: 'Encontre todos os pares antes das jogadas acabarem.',
    rules: 'Clique em duas cartas por vez. Se forem iguais, você ganha um ponto.'
  },
  {
    id: 'clicker',
    name: 'Clicker de Tempo',
    description: 'Clique o máximo possível em 15 segundos.',
    rules: 'Quanto mais cliques, maior a pontuação final.'
  }
];

function saveUsers() {
  saveJSON(usersFile, users);
}

function saveScores() {
  saveJSON(scoresFile, scores);
}

function getUserByEmail(email) {
  return Object.values(users).find((user) => user.email === email.toLowerCase());
}

function getUserById(id) {
  return users[id] || null;
}

function authenticate(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice(7);
  const userId = sessions[token];
  return userId ? getUserById(userId) : null;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data ? JSON.parse(data) : {});
    });
  });
}

function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(req.url.split('?')[0]);
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.join(publicDir, safePath.replace(/^\//, ''));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
    res.end(content);
    return;
  }

  const fallback = path.join(publicDir, 'index.html');
  const fallbackContent = fs.readFileSync(fallback);
  res.writeHead(200, { 'Content-Type': getMimeType(fallback) });
  res.end(fallbackContent);
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJSON(res, 200, { ok: true, message: 'Servidor online' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/games') {
    sendJSON(res, 200, { games });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    const body = await readBody(req);
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    if (!name || !email || !password) {
      sendJSON(res, 400, { message: 'Preencha nome, e-mail e senha.' });
      return;
    }

    if (getUserByEmail(email)) {
      sendJSON(res, 409, { message: 'Este e-mail já está cadastrado.' });
      return;
    }

    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const user = {
      id,
      name,
      email,
      password,
      avatar: '🧑'
    };

    users[id] = user;
    saveUsers();

    const token = crypto.randomBytes(24).toString('hex');
    sessions[token] = id;

    sendJSON(res, 201, { user, token });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    const body = await readBody(req);
    const email = (body.email || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    const user = getUserByEmail(email);
    if (!user || user.password !== password) {
      sendJSON(res, 401, { message: 'E-mail ou senha inválidos.' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    sessions[token] = user.id;

    sendJSON(res, 200, { user, token });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/me') {
    const user = authenticate(req);
    if (!user) {
      sendJSON(res, 401, { message: 'Sessão inválida.' });
      return;
    }

    sendJSON(res, 200, { user });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/score') {
    const user = authenticate(req);
    if (!user) {
      sendJSON(res, 401, { message: 'Sessão inválida.' });
      return;
    }

    const body = await readBody(req);
    const gameId = body.gameId;
    const score = Number(body.score || 0);
    const game = games.find((item) => item.id === gameId);

    if (!game) {
      sendJSON(res, 404, { message: 'Jogo não encontrado.' });
      return;
    }

    const entry = {
      id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      userName: user.name,
      gameId: game.id,
      gameName: game.name,
      score,
      createdAt: new Date().toISOString()
    };

    scores.push(entry);
    saveScores();

    sendJSON(res, 201, { ok: true, score: entry });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/ranking') {
    const rankings = games.map((game) => {
      const filtered = scores
        .filter((item) => item.gameId === game.id)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => ({
          user: item.userName,
          score: item.score,
          createdAt: item.createdAt
        }));

      return { game: game.name, gameId: game.id, ranking: filtered };
    });

    sendJSON(res, 200, { rankings });
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/ranking/')) {
    const gameId = pathname.split('/').pop();
    const game = games.find((item) => item.id === gameId);

    if (!game) {
      sendJSON(res, 404, { message: 'Jogo não encontrado.' });
      return;
    }

    const ranking = scores
      .filter((item) => item.gameId === gameId)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((item) => ({
        user: item.userName,
        score: item.score,
        createdAt: item.createdAt
      }));

    sendJSON(res, 200, { game: game.name, ranking });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/history') {
    const user = authenticate(req);
    if (!user) {
      sendJSON(res, 401, { message: 'Sessão inválida.' });
      return;
    }

    const history = scores
      .filter((entry) => entry.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map((entry) => ({
        game: entry.gameName,
        score: entry.score,
        createdAt: entry.createdAt
      }));

    sendJSON(res, 200, { history });
    return;
  }

  sendJSON(res, 404, { message: 'Rota não encontrada.' });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res).catch((error) => {
      console.error(error);
      sendJSON(res, 500, { message: 'Erro interno do servidor.' });
    });
  } else {
    serveStatic(req, res);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
