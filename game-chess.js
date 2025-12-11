// minimal playable chess UI using chess.js for rules (server authoritative)
(function(){
  if(typeof Chess === 'undefined' && typeof window !== 'undefined'){
    // chess.js loaded via package on server; in browser we emulate light UI, server validates
  }

  window.initChess = function({ socket, code, name, mount }){
    mount.innerHTML = '';
    const board = document.createElement('div');
    board.id = 'chessBoard';
    board.style.display = 'grid';
    board.style.gridTemplateColumns = 'repeat(8, 44px)';
    board.style.gridGap = '2px';
    mount.appendChild(board);

    function renderEmpty(){
      board.innerHTML = '';
      for(let r=8;r>=1;r--){
        for(let f=0;f<8;f++){
          const s = document.createElement('div');
          s.style.width='44px'; s.style.height='44px'; s.style.display='flex'; s.style.alignItems='center'; s.style.justifyContent='center';
          s.style.background = ((r+f)%2===0)?'#f0d9b5':'#b58863';
          s.dataset.coord = `${'abcdefgh'[f]}${r}`;
          s.addEventListener('click', ()=>onSquareClick(s.dataset.coord));
          board.appendChild(s);
        }
      }
    }

    let selected = null;
    function onSquareClick(coord){
      if(!selected) selected = coord;
      else {
        // send move to server
        socket.emit('chess_move', { code, move: { from: selected, to: coord } }, (res)=>{
          if(res?.error) alert(res.error);
        });
        selected = null;
      }
    }

    renderEmpty();

    // server will emit 'move' with fen, but we don't have chess.js in browser; we'll simple put SAN or from->to text
    const log = document.createElement('div'); log.style.marginTop='8px';
    mount.appendChild(log);

    socket.on('move', ({ game, move, fen })=>{
      if(game !== 'chess') return;
      // update board simply marking move squares
      // we show recent move text
      const d = document.createElement('div');
      d.textContent = `${move.san || (move.from+'-'+move.to)}`;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    });

    socket.on('game_over', ({ game, reason, winnerColor })=>{
      if(game !== 'chess') return;
      alert('Chess over: ' + (reason || 'finished'));
    });

    socket.on('reveal_secret', ({ secret })=>{
      alert('Winner secret revealed: ' + secret);
    });
  };
})();
