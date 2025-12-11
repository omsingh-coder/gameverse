(function(){
  window.initTtt = function({ socket, code, name, mount }){
    mount.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(3,80px)'; grid.style.gap='8px';
    const cells = [];
    for(let i=0;i<9;i++){
      const c = document.createElement('div');
      c.style.width='80px'; c.style.height='80px'; c.style.display='flex'; c.style.alignItems='center'; c.style.justifyContent='center';
      c.style.background='rgba(255,255,255,0.03)'; c.style.fontSize='28px';
      c.dataset.i = i;
      c.addEventListener('click', ()=> {
        socket.emit('ttt_move', { code, index: i }, (res)=> { if(res?.error) alert(res.error); });
      });
      grid.appendChild(c); cells.push(c);
    }
    mount.appendChild(grid);

    socket.on('move', ({ game, board })=>{
      if(game !== 'ttt') return;
      board.forEach((v,i)=> cells[i].textContent = v || '');
    });

    socket.on('game_over', ({ game, winner })=>{
      if(game !== 'ttt') return;
      if(winner) alert('Winner: ' + winner);
      else alert('Draw');
    });

    socket.on('reveal_secret', ({ secret })=>{
      alert('Secret: ' + secret);
    });
  };
})();
