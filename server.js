const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const RoomManager = require("./room-manager");
const roomManager = new RoomManager();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// Serve static files
app.use(express.static(__dirname));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // -------------------------------
  // 🚀 JOIN ROOM
  // -------------------------------
  socket.on("join_room", ({ roomId, playerName }) => {
    const room = roomManager.joinRoom(roomId, socket.id, playerName);

    socket.join(roomId);

    io.to(roomId).emit("room_update", room);

    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // -------------------------------
  // 🎮 CHOOSE GAME
  // -------------------------------
  socket.on("select_game", ({ roomId, game }) => {
    roomManager.setGame(roomId, game);
    io.to(roomId).emit("game_selected", game);
  });

  // ======================================================
  // 🎲 LUDO EVENTS
  // ======================================================
  socket.on("ludo_roll_dice", ({ roomId, player }) => {
    const value = Math.floor(Math.random() * 6) + 1;
    io.to(roomId).emit("ludo_dice_result", { player, value });
  });

  socket.on("ludo_move_token", ({ roomId, tokenId, player }) => {
    io.to(roomId).emit("ludo_update_move", { tokenId, player });
  });

  // ======================================================
  // ♟ CHESS EVENTS
  // ======================================================
  socket.on("chess_move", ({ roomId, from, to, piece }) => {
    io.to(roomId).emit("chess_move_update", { from, to, piece });
  });

  // ======================================================
  // ❌⭕ TIC TAC TOE EVENTS
  // ======================================================
  socket.on("ttt_move", ({ roomId, index, player }) => {
    io.to(roomId).emit("ttt_update", { index, player });
  });

  socket.on("ttt_restart", (roomId) => {
    io.to(roomId).emit("ttt_restart_game");
  });

  // ======================================================
  // 🏁 GAME OVER (ALL GAMES)
  // ======================================================
  socket.on("game_over", ({ roomId, winner }) => {
    io.to(roomId).emit("game_finish", winner);
  });

  // ======================================================
  // 🚪 DISCONNECT
  // ======================================================
  socket.on("disconnect", () => {
    const updatedRoom = roomManager.removePlayer(socket.id);

    if (updatedRoom) {
      io.to(updatedRoom.roomId).emit("room_update", updatedRoom);
    }

    console.log("User disconnected:", socket.id);
  });
});

// ---------------------------------------------------

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
