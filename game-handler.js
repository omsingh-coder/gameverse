// Top-level socket handler: rooms, game selection, start, moves, secrets
const RoomManager = require('./room-manager');
const { encryptSecret, decryptSecret } = require('./secret-encryption');
const { Chess } = require('chess.js');

module.exports = function(io){
  const rooms = new RoomManager();

  io.on('connection', socket => {
    console.log('conn', socket.id);

    socket.on('create_room', (data, cb) => {
      const name = data?.name || data?.displayName || 'Guest';
      const code = rooms.createRoom(name, socket.id);
      socket.join(code);
      cb && cb({ ok:true, code });
      io.to(code).emit('room_update', rooms.getRoomInfo(code));
    });

    socket.on('join_room', (data, cb) => {
      const code = data?.code || data?.roomCode;
      const name = data?.name || data?.displayName || 'Guest';
      const res = rooms.joinRoom(code, socket.id, name);
      if(!res.ok) return cb && cb({ error: res.error });
      socket.join(code);
      cb && cb({ ok:true, code });
      io.to(code).emit('room_update', rooms.getRoomInfo(code));
    });

    socket.on('set_game', ({ code, game }, cb) => {
      const ok = rooms.setGame(code, game);
      if(!ok) return cb && cb({ error: 'Room not found' });
      io.to(code).emit('game_selected', { game });
      cb && cb({ ok:true });
    });

    socket.on('submit_secret', ({ code, secret }, cb) => {
      const enc = encryptSecret(secret || '');
      rooms.setPlayerSecret(code, socket.id, enc);
      cb && cb({ ok:true });
      io.to(code).emit('room_update', rooms.getRoomInfo(code));
    });

    socket.on('start_game', ({ code }, cb) => {
      const room = rooms.getRoom(code);
      if(!room) return cb && cb({ error:'Room not found' });
      // animated pre-game is done client-side, after that client should request actual start confirmation.
      io.to(code).emit('pre_game', { players: room.playersOrder.map(id => room.players[id].name), game: room.game });
      cb && cb({ ok:true });
    });

    // Chess specific: uses chess.js validation server-side for authority
    socket.on('chess_move', ({ code, move }, cb) => {
      const room = rooms.getRoom(code);
      if(!room) return cb && cb({ error:'Room not found' });
      if(!room.state) { room.state = {}; }
      if(!room.state.chess) room.state.chess = new Chess();
      const chess = room.state.chess;
      try {
        const m = chess.move(move);
        if(!m) return cb && cb({ error:'Illegal move' });
        // broadcast move and fen
        io.to(code).emit('move', { game:'chess', move: m, fen: chess.fen() });
        // game over?
        if(chess.game_over()){
          const winnerColor = chess.in_checkmate() ? (chess.turn() === 'w' ? 'black' : 'white') : null;
          rooms.finish = rooms.finish || {};
          rooms.finish[code] = { result: m };
          io.to(code).emit('game_over', { game:'chess', reason: chess.in_checkmate() ? 'checkmate' : 'finished', winnerColor });
          // reveal secret to winner socket id
          if(winnerColor){
            // map color to player order: first joined = white
            const whiteId = room.playersOrder[0];
            const blackId = room.playersOrder[1];
            const winnerId = winnerColor === 'white' ? whiteId : blackId;
            const loserId = winnerColor === 'white' ? blackId : whiteId;
            const enc = rooms.getPlayerEncryptedSecret(code, loserId);
            if(enc){
              try {
                const secret = decryptSecret(enc);
                io.to(winnerId).emit('reveal_secret', { secret });
              } catch(e){ console.error('decrypt fail', e); }
            }
          }
        }
        cb && cb({ ok:true, move: m });
      } catch(e){
        cb && cb({ error: 'move failed' });
      }
    });

    // TicTacToe move
    socket.on('ttt_move', ({ code, index }, cb) => {
      const room = rooms.getRoom(code);
      if(!room) return cb && cb({ error:'Room not found' });
      if(!room.state) room.state = {};
      if(!room.state.ttt) room.state.ttt = { board: Array(9).fill(null), turn: 0 };
      const state = room.state.ttt;
      if(state.board[index] !== null) return cb && cb({ error:'Cell occupied' });
      // find player index in playersOrder
      const pIndex = room.playersOrder.indexOf(socket.id);
      if(pIndex === -1) return cb && cb({ error:'Not in room' });
      if(state.turn % room.playersOrder.length !== pIndex) return cb && cb({ error:'Not your turn' });
      const symbol = (pIndex % 2 === 0) ? 'X' : 'O';
      state.board[index] = symbol;
      state.turn++;
      io.to(code).emit('move', { game:'ttt', board: state.board });
      // check win
      const wins = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
      ];
      let winner = null;
      for(const w of wins){
        const [a,b,c] = w;
        if(state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]){
          winner = state.board[a]; break;
        }
      }
      if(winner){
        io.to(code).emit('game_over', { game:'ttt', winner });
        // reveal secret to winner player(s) - map symbol to socket
        const winnerPlayerId = room.playersOrder.find(id => (room.playersOrder.indexOf(id) % 2 === (winner === 'X' ? 0 : 1)));
        const enc = rooms.getPlayerEncryptedSecret(code, winnerPlayerId);
        if(enc){ try{ const secret = decryptSecret(enc); io.to(winnerPlayerId).emit('reveal_secret',{secret}); }catch(e){ } }
      } else if(!state.board.includes(null)){
        io.to(code).emit('game_over', { game:'ttt', winner: null });
      }
      cb && cb({ ok:true });
    });

    // Ludo move: simple dice + advance token (server authoritative)
    socket.on('ludo_roll', ({ code }, cb) => {
      const room = rooms.getRoom(code);
      if(!room) return cb && cb({ error:'Room not found' });
      if(!room.state) room.state = {};
      if(!room.state.ludo) {
        // init tokens
        room.state.ludo = { tokens: {}, turnIndex:0 };
        room.playersOrder.forEach(id => room.state.ludo.tokens[id] = [-1,-1,-1,-1]);
      }
      const L = room.state.ludo;
      const currentId = room.playersOrder[L.turnIndex];
      if(currentId !== socket.id) return cb && cb({ error:'Not your turn' });
      const dice = Math.floor(Math.random()*6)+1;
      L.dice = dice;
      io.to(code).emit('ludo_roll', { playerId: socket.id, dice });
      cb && cb({ ok:true, dice });
    });

    socket.on('ludo_move', ({ code, tokenIndex, steps }, cb) => {
      const room = rooms.getRoom(code);
      if(!room || !room.state || !room.state.ludo) return cb && cb({ error:'invalid' });
      const L = room.state.ludo;
      const id = socket.id;
      const tokens = L.tokens[id];
      if(!tokens) return cb && cb({ error:'not in room' });
      // very simple rules: if off-board (-1) and steps===6, bring to 0; else advance if on-board
      if(tokens[tokenIndex] === -1){
        if(steps === 6) tokens[tokenIndex] = 0;
        else return cb && cb({ error:'Need 6 to enter' });
      } else {
        tokens[tokenIndex] += steps;
      }
      // broadcast updated tokens
      io.to(code).emit('ludo_update', { tokens: L.tokens });
      // move to next turn
      L.turnIndex = (L.turnIndex + 1) % room.playersOrder.length;
      io.to(code).emit('ludo_turn', { turnIndex: L.turnIndex });
      cb && cb({ ok:true });
    });

    socket.on('request_room_info', ({ code }, cb) => {
      cb && cb(rooms.getRoomInfo(code));
    });

    socket.on('disconnecting', () => {
      for(const code of socket.rooms){
        if(code === socket.id) continue;
        rooms.leaveRoom(code, socket.id);
        io.to(code).emit('room_update', rooms.getRoomInfo(code));
      }
    });
  });
};
