(function () {
  const PIECE_ICONS = {
    p: "♟️", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
    P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
  };

  window.initChess = function ({ socket, code, name, mount }) {
    mount.innerHTML = "";

    // Board container
    const board = document.createElement("div");
    board.id = "chess-board";
    board.style.display = "grid";
    board.style.gridTemplateColumns = "repeat(8, 48px)";
    board.style.gridTemplateRows = "repeat(8, 48px)";
    board.style.gap = "0px";
    board.style.margin = "auto";
    board.style.userSelect = "none";
    mount.appendChild(board);

    // Move log
    const log = document.createElement("div");
    log.className = "move-log";
    log.style.maxHeight = "150px";
    log.style.overflowY = "auto";
    log.style.marginTop = "10px";
    log.style.color = "#fff";
    mount.appendChild(log);

    let CURRENT_FEN = "";
    let selectedSquare = null;
    let myColor = null;

    // Render board from FEN
    function renderBoard(fen) {
      CURRENT_FEN = fen;
      board.innerHTML = "";

      const parts = fen.split(" ");
      const rows = parts[0].split("/");

      rows.forEach((row, rIndex) => {
        let file = 0;
        for (let char of row) {
          if (!isNaN(char)) {
            for (let i = 0; i < Number(char); i++) {
              renderSquare(rIndex, file, null);
              file++;
            }
          } else {
            renderSquare(rIndex, file, char);
            file++;
          }
        }
      });
    }

    function renderSquare(rIndex, file, piece) {
      const square = document.createElement("div");

      const rank = 8 - rIndex;
      const fileLetter = "abcdefgh"[file];
      const coord = fileLetter + rank;

      square.dataset.coord = coord;
      const isLight = (rIndex + file) % 2 === 0;
      square.style.width = "48px";
      square.style.height = "48px";
      square.style.display = "flex";
      square.style.alignItems = "center";
      square.style.justifyContent = "center";
      square.style.fontSize = "28px";
      square.style.cursor = "pointer";
      square.style.background = isLight ? "#eee" : "#444";

      // Highlight selected
      if (selectedSquare === coord) {
        square.style.outline = "3px solid #ff1aff";
      }

      if (piece) square.textContent = PIECE_ICONS[piece] || "";

      square.addEventListener("click", () => onClickSquare(coord));
      board.appendChild(square);
    }

    function onClickSquare(coord) {
      if (!selectedSquare) selectedSquare = coord;
      else {
        const move = { from: selectedSquare, to: coord };
        socket.emit("chess_move", { code, move }, (res) => {
          if (res?.error) alert(res.error);
        });
        selectedSquare = null;
        renderBoard(CURRENT_FEN);
      }
    }

    // Request initial game state
    socket.emit("request_game_state", { code }, (res) => {
      if (res?.fen) renderBoard(res.fen);
      if (res?.color) myColor = res.color;
    });

    // Listen for move updates
    socket.on("move", ({ game, move, fen }) => {
      if (game !== "chess") return;

      renderBoard(fen);

      const m = document.createElement("div");
      m.textContent = move.san || `${move.from} → ${move.to}`;
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
    });

    // Game over
    socket.on("game_over", ({ game, reason, winnerColor }) => {
      if (game !== "chess") return;
      if (winnerColor === myColor) alert("You won! Secret revealed next.");
      else if (!winnerColor) alert("Draw!");
      else alert("You lost!");
    });

    // Reveal secret
    socket.on("reveal_secret", ({ secret }) => {
      alert("🔐 Opponent Secret: " + secret);
    });
  };
})();
