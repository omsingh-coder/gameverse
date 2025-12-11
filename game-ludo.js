(function(){
  window.initLudo = function({ socket, code, name, mount }){

    mount.innerHTML = '';

    const status = document.createElement('div');
    status.style.color = '#fff';
    status.style.marginBottom = '8px';
    mount.appendChild(status);

    const board = document.createElement('div');
    board.style.display = 'grid';
    board.style.gridTemplateColumns = 'repeat(15,30px)';
    board.style.gridTemplateRows = 'repeat(15,30px)';
    board.style.gap = '2px';
    mount.appendChild(board);

    const diceBtn = document.createElement('button');
    diceBtn.textContent = 'Roll Dice';
    diceBtn.className='btn';
    mount.appendChild(diceBtn);

    // Local tokens
    const tokens = {}; // playerId -> [token1,token2,token3,token4]
    let myPlayerIndex = null;

    diceBtn.addEventListener('click', ()=>{
      socket.emit('ludo_roll_dice', { roomId: code, player: socket.id });
      diceBtn.disabled = true;
    });

    // -----------------------------
    // Update tokens
    // -----------------------------
    socket.on('ludo_update_move', ({ tokenId, player })=>{
      if(!tokens[player]) tokens[player] = [0,0,0,0];
      tokens[player][tokenId]++;
      renderTokens();
    });

    socket.on('ludo_dice_result', ({ player, value })=>{
      status.textContent = `${player===socket.id?'You':'Player'} rolled ${value}`;
      // enable move button for current player
      if(player === socket.id){
        const moveBtn = document.createElement('button');
        moveBtn.textContent = 'Move first token by ' + value;
        moveBtn.className='btn';
        mount.appendChild(moveBtn);
        moveBtn.onclick = ()=>{
          socket.emit('ludo_move_token', { roomId: code, tokenId: 0, player: socket.id });
          moveBtn.remove();
          diceBtn.disabled = false;
        };
      }
    });

    socket.on('ludo_turn', ({ turnIndex })=>{
      status.textContent += ` • Player turn index: ${turnIndex}`;
    });

    socket.on('game_finish', (winner)=>{
      if(winner===socket.id) alert('You won! Revealing secret...');
      else alert('Game over. Winner: ' + winner);
    });

    socket.on('reveal_secret', ({ secret })=>{
      alert('Winner secret revealed: ' + secret);
    });

    function renderTokens(){
      board.innerHTML='';
      for(const pid in tokens){
        tokens[pid].forEach((pos,i)=>{
          const cell = document.createElement('div');
          cell.style.width='30px';
          cell.style.height='30px';
          cell.style.backgroundColor = pid===socket.id ? 'cyan':'magenta';
          cell.style.color='#000';
          cell.style.display='flex';
          cell.style.alignItems='center';
          cell.style.justifyContent='center';
          cell.textContent = i+1;
          board.appendChild(cell);
        });
      }
    }

  };
})();
