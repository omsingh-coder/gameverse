// client bootstrap: handles index/room/game navigation and top-level socket
const socket = io();
const url = new URL(location);
const page = location.pathname.split('/').pop();

if(page === 'index.html' || page === '' || page === '/'){
  // index UI bindings
  const createBtn = document.getElementById('createBtn');
  const joinBtn = document.getElementById('joinBtn');
  const nameInput = document.getElementById('nameInput');
  const roomInput = document.getElementById('roomInput');

  createBtn?.addEventListener('click', ()=>{
    const name = nameInput.value || 'Guest';
    socket.emit('create_room', { name }, (res) => {
      if(res?.ok){
        const code = res.code;
        window.location = `room.html?room=${code}&name=${encodeURIComponent(name)}`;
      } else alert('Failed to create');
    });
  });

  joinBtn?.addEventListener('click', ()=>{
    const name = nameInput.value || 'Guest';
    const code = (roomInput.value || '').toUpperCase().trim();
    if(!code) return alert('Enter room code');
    socket.emit('join_room', { code, name }, (res) => {
      if(res?.ok) window.location = `room.html?room=${code}&name=${encodeURIComponent(name)}`;
      else alert(res?.error || 'Join failed');
    });
  });
}

// room page logic lives inline in room.html for smoother single-file behaviour

// game page bootstrap: detect game param and init modules
if(page === 'game.html'){
  const qs = url.searchParams;
  const code = qs.get('room');
  const name = qs.get('name');
  const game = qs.get('game');
  const header = document.getElementById('gameHeader');
  const boardWrap = document.getElementById('boardWrap');
  header.innerHTML = `<h2>${game.toUpperCase()}</h2><div>Room: ${code} • ${name}</div>`;
  // dispatch to game modules
  if(game === 'chess' && window.initChess) window.initChess({ socket, code, name, mount: boardWrap });
  if(game === 'ttt' && window.initTtt) window.initTtt({ socket, code, name, mount: boardWrap });
  if(game === 'ludo' && window.initLudo) window.initLudo({ socket, code, name, mount: boardWrap });
}
