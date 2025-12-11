(function(){
  window.initTtt = function({ socket, code, name, mount }){
    mount.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.display='grid';
    grid.style.gridTemplateColumns='repeat(3,80px)';
    grid.style.gap='8px';
    const cells = [];

    let mySymbol = null;
    let myTurn = false;

    // create cells
    for(let i=0;i<9;i++){
      const c = document.createElement('div');
      c.style.width='80px';
      c.style.height='80px';
      c.style.display='flex';
      c.style.alignItems='center';
      c.style.justifyContent='center';
      c.style.background='rgba(255,255,255,0.03)';
      c.style.fontSize='28px';
      c.style.cursor = 'pointer';
      c.dataset.i = i;
      c.addEventListener('click', ()=> {
        if(!myTurn) return alert('Wait for your turn');
        socket.emit('ttt_move', { code, index: i }, (res)=> {
          if(res?.error) alert(res.error);
        });
      });
      grid.appendChild(c); 
      cells.push(c);
    }
    mount.appendChild(grid);

    // Listen for turn assignment
    socket.on('ttt_start', ({ symbol, board })=>{
      mySymbol = symbol;
      myTurn = symbol === 'X'; // X always starts
      updateBoard(board);
      alert('Game started. You are ' + mySymbol + (myTurn ? ' and it is your turn':''));
    });

    // Listen for move updates
    socket.on('ttt_update', ({ board, turn })=>{
      updateBoard(board);
      myTurn = (turn === mySymbol);
    });

    // Game over
    socket.on('ttt_over', ({ winner })=>{
      if(winner === mySymbol) alert('You won! Secret revealed next');
      else if(!winner) alert('Draw!');
      else alert('You lost! Winner: ' + winner);
    });

    // Reveal secret
    socket.on('reveal_secret', ({ secret })=>{
      alert('Winner secret revealed: ' + secret);
    });

    function updateBoard(board){
      board.forEach((v,i)=> cells[i].textContent = v || '');
    }

  };
})();
