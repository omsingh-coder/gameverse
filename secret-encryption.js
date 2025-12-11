const crypto = require('crypto');
const MASTER_KEY = process.env.MASTER_KEY || null;
if(!MASTER_KEY) console.warn('WARNING: MASTER_KEY not set. Use a 32-byte key for stable secrets.');

function getKey(){
  if(!MASTER_KEY) return crypto.randomBytes(32);
  // if base64 string was provided accidentally, attempt decode, else use utf8 slice/pad
  let buf = Buffer.from(MASTER_KEY, 'base64');
  if(buf.length !== 32) buf = Buffer.from(MASTER_KEY, 'utf8');
  if(buf.length === 32) return buf;
  const out = Buffer.alloc(32);
  Buffer.from(MASTER_KEY).copy(out);
  return out;
}

function encryptSecret(plaintext){
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v:1, ciphertext: encrypted.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64') };
}

function decryptSecret(obj){
  const key = getKey();
  if(!obj) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(obj.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(obj.tag,'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(obj.ciphertext,'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
