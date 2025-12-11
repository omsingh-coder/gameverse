// ================================
// WebSocket connection
// ================================
const socket = io();

// Utility to switch pages
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

// Track selected game globally
let SELECTED_GAME = null;
let ROOM_CODE = null;

// ================================
// 1) MAIN PAGE — GAME SELECTOR
// ================================
const gameButtons = document.querySelectorAll(".game-card");

gameButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    SELECTED_GAME = btn.dataset.game;

    // Update text in room page
    document.getElementById("selected-game").innerText = SELECTED_GAME;

    showPage("room");
  });
});

// ================================
// 2) ROOM PAGE — Create Room / Join Room
// ================================
const createRoomBtn = document.getElementById("create-room");
const joinRoomBtn   = document.getElementById("join-room");
const playerName    = document.getElementById("player-name");
const playerSecret  = document.getElementById("player-secret");
const joinCode      = document.getElementById("join-code");

const backBtn = document.getElementById("back-to-selector");

backBtn.addEventListener("click", () => {
  showPage("selector");
});

createRoomBtn.addEventListener("click", () => {
  const name = playerName.value.trim();
  if (!name) return alert("Enter your name first");

  socket.emit("create_room", { displayName: name }, res => {
    if (!res.ok) return alert("Room creation failed");
    ROOM_CODE = res.roomCode;
    enterRoom();
  });
});

joinRoomBtn.addEventListener("click", () => {
  const name = playerName.value.trim();
  const code = joinCode.value.trim().toUpperCase();

  if (!name) return alert("Enter your name");
  if (!code) return alert("Enter room code");

  socket.emit("join_room", { roomCode: code, displayName: name }, res => {
    if (!res.ok) return alert(res.error);
    ROOM_CODE = code;
    enterRoom();
  });
});

// Enter room UI
function enterRoom() {
  document.getElementById("room-area").classList.remove("hidden");
  document.getElementById("room-code").innerText = ROOM_CODE;

  updateRoomInfo();
}

// Request room info every join
function updateRoomInfo() {
  socket.emit("request_room_info", { roomCode: ROOM_CODE }, info => {
    renderPlayers(info?.players);
  });
}

// Render players inside room
function renderPlayers(players = []) {
  const div = document.getElementById("players-list");
  div.innerHTML = "";

  players.forEach(p => {
    const el = document.createElement("div");
    el.className = "player-card";
    el.innerHTML = `<span>${p.displayName}</span>`;
    div.appendChild(el);
  });

  if (players.length >= 2)
    document.getElementById("start-game").classList.remove("disabled");
}

// Live update
socket.on("room_update", info => {
  renderPlayers(info.players);
});

// ================================
// 3) START GAME
// ================================
const startBtn = document.getElementById("start-game");

startBtn.addEventListener("click", () => {
  const secret = playerSecret.value.trim();

  socket.emit("submit_secret", { roomCode: ROOM_CODE, secret }, res => {
    if (!res.ok) return alert("Secret submit failed");
  });
});

// Server starts game
socket.on("game_start", res => {
  window.location = `game.html?room=${ROOM_CODE}&game=${SELECTED_GAME}`;
});

// ================================
// 4) GAME PAGE BOOTSTRAP
// ================================
if (location.pathname.includes("game.html")) {
  const qs = new URLSearchParams(location.search);

  const game = qs.get("game");
  const room = qs.get("room");

  const wrap = document.getElementById("game-area");
  document.getElementById("game-title").innerText = game.toUpperCase();

  if (game === "chess") window.initChess({ socket, roomCode: room, mount: wrap });
  if (game === "tic-tac-toe") window.initTtt({ socket, roomCode: room, mount: wrap });
  if (game === "mini-ludo") window.initLudo({ socket, roomCode: room, mount: wrap });
}
