const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const createSocketHandler = require('./game-handler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*'} });

app.use(express.static(path.join(__dirname, '/')));

createSocketHandler(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Set MASTER_KEY env var (32 bytes) for secret encryption.');
});
