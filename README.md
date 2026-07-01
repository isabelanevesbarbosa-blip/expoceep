# Plataforma de Jogos - GameHub Escolar

## O que é
Esta é uma plataforma simples de jogos com:
- cadastro e login de usuários
- catálogo de jogos
- salvamento de pontuações
- ranking por jogo
- histórico de partidas

## Jogos incluídos
1. Jogo da Memória
2. Clicker de Tempo

## Como rodar
1. Entre na pasta do projeto:
   ```bash
   cd c:\Users\Admin\Desktop\isa
   ```
2. Instale as dependências (não há dependências externas, então basta usar o Node.js):
   ```bash
   npm install
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```
4. Abra no navegador:
   ```text
   http://localhost:3000
   ```

## Endpoints principais
- POST /api/register
- POST /api/login
- GET /api/games
- POST /api/score
- GET /api/ranking
- GET /api/history

## Observação
Os dados são salvos localmente em arquivos JSON dentro da pasta data/.
