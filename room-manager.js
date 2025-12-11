// lightweight in-memory room manager
class RoomManager {
  constructor(){ this.rooms = new Map(); }

  makeCode(len=4){
    // mix alnum
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for(let i=0;i<len;i++) code += chars[Math.floor(Math.random()*chars.length)];
    return code;
  }

  createRoom(displayName, socketId){
    const code = this.makeCode(4);
    const room = {
      code,
      playersOrder: socketId ? [socketId] : [],
      players: socketId ? { [socketId]: { name: displayName || 'Guest', encryptedSecret: null } } : {},
      game: null,
      state: null
    };
    this.rooms.set(code, room);
    return code;
  }

  joinRoom(code, socketId, displayName){
    const room = this.rooms.get(code);
    if(!room) return { ok:false, error:'Room not found' };
    // allow up to 4 players for ludo
    if(Object.keys(room.players).length >= 4) return { ok:false, error: 'Room full' };
    room.playersOrder.push(socketId);
    room.players[socketId] = { name: displayName || 'Guest', encryptedSecret: null };
    return { ok:true };
  }

  leaveRoom(code, socketId){
    const room = this.rooms.get(code);
    if(!room) return;
    delete room.players[socketId];
    room.playersOrder = room.playersOrder.filter(id => id !== socketId);
    if(room.playersOrder.length === 0) this.rooms.delete(code);
  }

  getRoom(code){ return this.rooms.get(code); }

  getRoomInfo(code){
    const room = this.rooms.get(code);
    if(!room) return null;
    return {
      code: room.code,
      players: room.playersOrder.map(id => ({ id, name: room.players[id]?.name || 'Guest', hasSecret: !!room.players[id]?.encryptedSecret })),
      game: room.game
    };
  }

  setGame(code, game){
    const room = this.rooms.get(code);
    if(!room) return false;
    room.game = game;
    // initialize game state per type
    if(game === 'chess'){
      room.state = { fen: null, chessStarted: false };
    } else if(game === 'tictactoe'){
      room.state = { board: Array(9).fill(null), turnIndex: 0 };
    } else if(game === 'ludo'){
      // tokens positions per player (off-board = -1). We'll map playersOrder -> color
      room.state = { tokens: {}, turnIndex: 0, dice: null };
      room.playersOrder.forEach((id, i) => room.state.tokens[id] = [ -1, -1, -1, -1 ]);
    } else {
      room.state = null;
    }
    return true;
  }

  setPlayerSecret(code, socketId, enc){
    const room = this.rooms.get(code);
    if(!room || !room.players[socketId]) return false;
    room.players[socketId].encryptedSecret = enc;
    return true;
  }

  getPlayerEncryptedSecret(code, socketId){
    const room = this.rooms.get(code);
    return room?.players[socketId]?.encryptedSecret || null;
  }
}

module.exports = RoomManager;
