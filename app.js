// app.js — Single-folder, frontend-only game hub with room system using localStorage sync (works across tabs)
// Games included: Tic Tac Toe, Memory Duel (pair-matching), Mini Ludo (simple race)
// Winner-only secret reveal implemented. Crush name is stored in data-crush attribute in HTML and shown obfuscated.

(() => {
  // -- Utilities ---------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rand = (len = 6) => Math.random().toString(36).slice(2, 2 + len).toUpperCase();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // DOM elements
  const selectorPage = $('#selector');
  const roomPage = $('#room');
  const gameCanvas = $('#game-canvas');
  const selectedGameLabel = $('#selected-game');
  const gameTitle = $('#game-title');
  const gameArea = $('#game-area');
  const backButtons = $$('.back');

  const playerNameInput = $('#player-name');
  const playerSecretInput = $('#player-secret');
  const createRoomBtn = $('#create-room');
  const joinRoomBtn = $('#join-room');
  const joinCodeInput = $('#join-code');
  const roomArea = $('#room-area');
  const roomCodeDisplay = $('#room-code');
  const playersList = $('#players-list');
  const startGameBtn = $('#start-game');
  const leaveGameBtn = $('#leave-game');

  // State
  let state = {
    page: 'selector',
    game: null,
    room: null, // { code, players: [{id,name,secret}], hostId }
    me: null, // {id, name, secret}
    localId: rand(8),
  };

  // Local storage keys
  const ROOM_KEY = (code) => `PALAK_ROOM_${code}`;

  // -- Crush name obfuscation --------------------------------------------
  const crushAttr = document.querySelector('.crush-deco')?.dataset?.crush || '';
  // show obfuscated as decorative text in footer
  const footer = document.querySelector('.footer-note');
  if (footer) {
    const ob = crushAttr.split('').map((c,i)=> (i%2? '✦':'✧')).join('');
    footer.innerHTML = `Made with ❤️ — ${ob}`;
  }

  // Helper: switch pages
  function showPage(pageName){
    state.page = pageName;
    [selectorPage, roomPage, gameCanvas].forEach(p => p.classList.add('hidden'));
    if (pageName === 'selector') selectorPage.classList.remove('hidden');
    if (pageName === 'room') roomPage.classList.remove('hidden');
    if (pageName === 'game') gameCanvas.classList.remove('hidden');
  }

  // -- Room logic (frontend-only, sync via localStorage events) -----------
  function createRoom(gameKey){
    const code = rand(5);
    const roomObj = { code, game: gameKey, hostId: state.localId, players: [] };
    localStorage.setItem(ROOM_KEY(code), JSON.stringify(roomObj));
    return roomObj;
  }

  function loadRoom(code){
    try {
      const raw = localStorage.getItem(ROOM_KEY(code));
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }

  function saveRoom(room){
    localStorage.setItem(ROOM_KEY(room.code), JSON.stringify(room));
    // also notify other tabs by touching a notify key
    localStorage.setItem(`PALAK_ROOM_NOTIFY_${room.code}`, Date.now().toString());
  }

  function joinRoom(code, name, secret){
    let room = loadRoom(code);
    if (!room) return { error: 'Invalid room code' };
    // avoid duplicate entries for same localId
    room.players = room.players.filter(p => p.id !== state.localId);
    const player = { id: state.localId, name: name || 'Guest', secret: secret || '' };
    room.players.push(player);
    saveRoom(room);
    state.room = room;
    state.me = player;
    return { ok: true };
  }

  function leaveRoom(){
    if (!state.room) return;
    let room = loadRoom(state.room.code);
    if (!room) { state.room = null; state.me = null; return; }
    room.players = room.players.filter(p => p.id !== state.localId);
    // if no players left, remove room
    if (room.players.length === 0) {
      localStorage.removeItem(ROOM_KEY(room.code));
    } else {
      // if host left, transfer host
      if (room.hostId === state.localId) room.hostId = room.players[0].id;
      saveRoom(room);
    }
    state.room = null;
    state.me = null;
  }

  function renderPlayers(){
    playersList.innerHTML = '';
    if (!state.room) return;
    state.room.players.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'player-card';
      const you = (p.id === state.localId);
      // show name but obfuscate last char to hide crush name glimpses
      const displayName = p.name.replace(/.(?=.$)/g, '*');
      div.innerHTML = `<div><strong>${displayName}</strong> ${you? '(You)':''}</div>`;
      playersList.appendChild(div);
      // slight stagger animation
      div.style.animationDelay = `${idx * 80}ms`;
    });

    roomArea.classList.remove('hidden');
    roomCodeDisplay.textContent = state.room.code;
    // enable start only if host and at least 2 players
    if (state.room.hostId === state.localId && state.room.players.length >= 2) {
      startGameBtn.classList.remove('disabled');
    } else {
      startGameBtn.classList.add('disabled');
    }
  }

  // Listen for storage events to sync across tabs
  window.addEventListener('storage', (ev) => {
    try {
      if (!state.room) return; // not in a room
      if (ev.key === ROOM_KEY(state.room.code) || (ev.key && ev.key.startsWith(`PALAK_ROOM_NOTIFY_${state.room.code}`))) {
        const updated = loadRoom(state.room.code);
        if (updated) {
          state.room = updated;
          renderPlayers();
        }
      }
    } catch(e) { console.warn(e); }
  });

  // -- Game launch / lifecycle ------------------------------------------
  function startGame(){
    if (!state.room) return alert('No room');
    if (state.room.players.length < 2) return alert('At least 2 players required');
    // send simple kickoff flag in storage so other tabs can know
    localStorage.setItem(`PALAK_GAME_START_${state.room.code}`, JSON.stringify({ when: Date.now(), game: state.room.game }));
    loadGame(state.room.game);
    showPage('game');
  }

  // detect remote start
  window.addEventListener('storage', (ev) => {
    if (!ev.key) return;
    if (!state.room) return;
    if (ev.key === `PALAK_GAME_START_${state.room.code}`) {
      // remote started: load game
      loadGame(state.room.game);
      showPage('game');
    }
  });

  // -- Game implementations ---------------------------------------------
  // We'll implement each game as an object with mount(container, players, me, onFinish)

  // Tic Tac Toe: 2 players only, X vs O, simple turn-based
  const TicTacToe = {
    mount(container, players, me, onFinish) {
      container.innerHTML = '';
      const board = Array(9).fill(null);
      const turnIndex = 0; // host always starts
      let current = players.findIndex(p => p.id === players[0].id); // host
      let currentSymbol = 'X';
      // map players[0] => X, players[1] => O
      const symbols = {};
      symbols[players[0].id] = 'X';
      symbols[players[1].id] = 'O';

      const info = document.createElement('div');
      info.style.marginBottom = '10px';
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(3,1fr)';
      grid.style.gap = '8px';

      function render(){
        info.textContent = `Turn: ${players[current].name.replace(/.(?=.$)/g,'*')} (${symbols[players[current].id]})`;
        grid.innerHTML = '';
        board.forEach((v,i)=>{
          const cell = document.createElement('button');
          cell.style.padding = '18px 0';
          cell.style.fontSize = '1.3rem';
          cell.style.borderRadius = '10px';
          cell.style.border = 'none';
          cell.style.background = '#2a2a2a';
          cell.textContent = v || '';
          cell.disabled = !!v || players[current].id !== me.id; // only current player can move
          cell.addEventListener('click', ()=>{
            board[i] = symbols[players[current].id];
            // next
            current = (current + 1) % players.length;
            render();
            const winner = checkWinner();
            if (winner) finish(winner);
            else if (board.every(Boolean)) finish(null);
          });
          grid.appendChild(cell);
        });
      }

      function checkWinner(){
        const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for (const [a,b,c] of lines){
          if (board[a] && board[a]===board[b] && board[b]===board[c]) return board[a];
        }
        return null;
      }

      function finish(winnerSymbol){
        let winnerPlayer = null;
        if (winnerSymbol) winnerPlayer = players.find(p => symbols[p.id]===winnerSymbol);
        onFinish(winnerPlayer);
      }

      container.appendChild(info);
      container.appendChild(grid);
      render();
    }
  };

  // Memory Duel: competitive matching, players take turns flipping two cards. If they match, they score and play again. First to majority wins.
  const MemoryDuel = {
    mount(container, players, me, onFinish) {
      container.innerHTML = '';
      const pairs = 6; // total cards 12
      const symbols = Array.from({length:pairs}, (_,i)=>i+1).flatMap(x=>[x,x]);
      // shuffle
      for (let i = symbols.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1)); [symbols[i],symbols[j]]=[symbols[j],symbols[i]];
      }
      const stateBoard = symbols.map(()=>({revealed:false, takenBy:null}));
      const scores = {}; players.forEach(p=>scores[p.id]=0);
      let currentIdx = 0;

      const info = document.createElement('div'); info.style.marginBottom='10px';
      const grid = document.createElement('div');
      grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(6,1fr)'; grid.style.gap='8px';

      let firstPick = null;

      function render(){
        info.textContent = `Turn: ${players[currentIdx].name.replace(/.(?=.$)/g,'*')} — Scores: ${players.map(p=>p.name.replace(/.(?=.$)/g,'*')+' '+scores[p.id]).join(' | ')}`;
        grid.innerHTML='';
        stateBoard.forEach((c,i)=>{
          const btn = document.createElement('button');
          btn.style.padding='14px'; btn.style.borderRadius='8px'; btn.style.border='none'; btn.style.background='#2a2a2a';
          btn.textContent = (c.revealed || c.takenBy) ? symbols[i] : '?';
          btn.disabled = c.takenBy || players[currentIdx].id !== me.id;
          btn.addEventListener('click', ()=>{
            if (firstPick === null){
              c.revealed = true; firstPick = i; render();
            } else if (firstPick === i) return; else {
              c.revealed = true; render();
              // check
              if (symbols[firstPick] === symbols[i]){
                // match
                stateBoard[firstPick].takenBy = players[currentIdx].id;
                stateBoard[i].takenBy = players[currentIdx].id;
                scores[players[currentIdx].id] += 1;
                firstPick = null;
                // check end
                const totalTaken = Object.values(scores).reduce((a,b)=>a+b,0);
                if (totalTaken >= pairs) {
                  // winner is max score
                  const winnerId = Object.keys(scores).sort((a,b)=>scores[b]-scores[a])[0];
                  const winner = players.find(p=>p.id===winnerId);
                  onFinish(winner);
                } else {
                  render();
                }
              } else {
                // mismatch: brief reveal then hide and pass turn
                setTimeout(()=>{
                  stateBoard[firstPick].revealed = false;
                  stateBoard[i].revealed = false;
                  firstPick = null;
                  currentIdx = (currentIdx+1)%players.length;
                  render();
                }, 700);
              }
            }
          });
          grid.appendChild(btn);
        });
      }

      container.appendChild(info); container.appendChild(grid); render();
    }
  };

  // Mini Ludo: very simplified race. Each player rolls a die (1-6) and moves along track of length 20. First to reach or pass 20 wins.
  const MiniLudo = {
    mount(container, players, me, onFinish) {
      container.innerHTML = '';
      const goal = 20;
      const positions = {}; players.forEach(p=>positions[p.id]=0);
      let turnIdx = 0;

      const info = document.createElement('div'); info.style.marginBottom='10px';
      const track = document.createElement('div'); track.style.display='flex'; track.style.gap='6px'; track.style.flexWrap='wrap';

      function render(){
        info.innerHTML = `Turn: ${players[turnIdx].name.replace(/.(?=.$)/g,'*')}<br>` + players.map(p=>`${p.name.replace(/.(?=.$)/g,'*')}: ${positions[p.id]}`).join(' | ');
        track.innerHTML = '';
        for (let i=0;i<=goal;i++){
          const cell = document.createElement('div');
          cell.style.width='28px'; cell.style.height='28px'; cell.style.borderRadius='6px'; cell.style.display='flex'; cell.style.alignItems='center'; cell.style.justifyContent='center';
          cell.style.background = '#222'; cell.style.fontSize='12px';
          const occupants = players.filter(p=>positions[p.id]===i).map(p=>p.name[0]||'?').join('');
          cell.textContent = occupants || (i===goal?'🏁':i);
          track.appendChild(cell);
        }
      }

      const rollBtn = document.createElement('button'); rollBtn.textContent='Roll Dice'; rollBtn.style.marginTop='12px';
      rollBtn.addEventListener('click', ()=>{
        if (players[turnIdx].id !== me.id) return;
        const r = Math.floor(Math.random()*6)+1;
        positions[players[turnIdx].id] += r;
        if (positions[players[turnIdx].id] >
