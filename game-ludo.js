(function(){
  window.initLudo = function({ socket, code, name, mount }){
    mount.innerHTML = '';
    const status = document.createElement('div'); status.textContent='Ludo - simple mode';
    mount.appendChild(status);
    const rollBtn = document.createElement('button'); rollBtn.textContent = 'Roll Dice'; rollBtn.className='btn';
    mount.appendChild(rollBtn);
    const tokensWrap = document.createElement('div'); tokensWrap.style.marginTop='10px'; mount.appendChild(tokensWrap);

    rollBtn.addEventListener('click', ()=>{
      socket.emit('ludo_roll', { code }, (res)=> {
        if(res?.error) alert(res.error);
      });
    });

    socket.on('ludo_roll', ({ playerId, dice })=>{
      status.textContent = `${playerId === socket.id ? 'You' : 'Player'} rolled ${dice}`;
      // offer simple move option for current player
      if(playerId === socket.id){
        const moveBtn = document.createElement('button'); moveBtn.textContent = 'Move one token by ' + dice; moveBtn.className='btn';
        mount.appendChild(moveBtn);
        moveBtn.onclick = ()=> {
          socket.emit('ludo_move', { code, tokenIndex: 0, steps: dice }, res => {
            if(res?.error) alert(res.error);
            moveBtn.remove();
          });
        };
      }
    });

    socket.on('ludo_update', ({ tokens })=>{
      tokensWrap.innerHTML = '<pre style="white-space:pre-wrap;color:#fff">'+JSON.stringify(tokens,null,2)+'</pre>';
    });

    socket.on('ludo_turn', ({ turnIndex })=>{
      status.textContent += ` • Next turn index: ${turnIndex}`;
    });

    socket.on('reveal_secret', ({ secret })=>{
      alert('Secret: ' + secret);
    });
  };
})();
