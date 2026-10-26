const express = require('express');
const { Pool } = require('pg');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Ligação à Base de Dados do Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Cria a tabela de mensagens automaticamente
pool.query(`CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  username TEXT,
  text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

app.use(express.static('.')); // Serve o teu ficheiro index.html

wss.on('connection', (ws) => {
  // Envia o histórico de mensagens quando alguém entra
  pool.query('SELECT * FROM messages ORDER BY created_at ASC LIMIT 50', (err, res) => {
    if (!err) ws.send(JSON.stringify({ type: 'history', data: res.rows }));
  });

  // Quando recebe uma mensagem, guarda no PostgreSQL e envia para todos
  ws.on('message', async (msg) => {
    const data = JSON.parse(msg);
    if (data.type === 'message') {
       const result = await pool.query(
         'INSERT INTO messages (username, text) VALUES ($1, $2) RETURNING *', 
         [data.username, data.text]
       );
       wss.clients.forEach(client => {
         if (client.readyState === WebSocket.OPEN) {
           client.send(JSON.stringify({ type: 'new_message', data: result.rows[0] }));
         }
       });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));
