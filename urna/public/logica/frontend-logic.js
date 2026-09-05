// frontend-logic.js
// Serviços essenciais para a urna: geração de chaves, import de carga, verificação de hash,
// fluxo de votação (input/confirm), contagem local e export do poll_report.
// Usa Web Crypto API e localStorage para persistência simples.

const STORAGE_KEYS = {
  KEYS: 'urna:keys',
  CANDIDATES: 'urna:candidates',
  TALLY: 'urna:tally',
  SESSION: 'urna:session'
};

// ---- util ----
function abToBase64(buf) {
  if (typeof Buffer !== 'undefined') return Buffer.from(new Uint8Array(buf)).toString('base64');
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function base64ToAb(b64) {
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64');
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}
function abToHex(buf) {
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
}
function textToAb(str){
  return new TextEncoder().encode(str).buffer;
}
function abToText(buf){
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buf)) return Buffer.from(buf).toString();
  return new TextDecoder().decode(buf);
}
function stableStringify(obj){
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

// ---- hash service ----
async function hashJson(obj){
  const json = stableStringify(obj);
  const buf = textToAb(json);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return abToHex(digest);
}

// ---- PEM helpers ----
function _arrayBufferToBase64(buffer){
  return abToBase64(buffer);
}
function _base64ToArrayBuffer(b64){
  return base64ToAb(b64);
}
function spkiToPem(spkiBuffer){
  const b64 = _arrayBufferToBase64(spkiBuffer);
  const pem = "-----BEGIN PUBLIC KEY-----\n" + b64.match(/.{1,64}/g).join('\n') + "\n-----END PUBLIC KEY-----";
  return pem;
}
function pkcs8ToPem(pkcs8Buffer){
  const b64 = _arrayBufferToBase64(pkcs8Buffer);
  const pem = "-----BEGIN PRIVATE KEY-----\n" + b64.match(/.{1,64}/g).join('\n') + "\n-----END PRIVATE KEY-----";
  return pem;
}
function pemToArrayBuffer(pem){
  const b64 = pem.replace(/-----.*?-----|\n|\r/g,'');
  return _base64ToArrayBuffer(b64);
}

// ---- storage ----
const storage = {
  get(key){
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },
  set(key, val){
    localStorage.setItem(key, JSON.stringify(val));
  },
  remove(key){ localStorage.removeItem(key); }
};

// ---- crypto service (keys + encrypt/decrypt) ----
async function generateAndStoreKeys(){
  // RSA-OAEP 2048
  const keyPair = await crypto.subtle.generateKey(
    {name:'RSA-OAEP', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'},
    true,
    ['encrypt','decrypt']
  );
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const publicPem = spkiToPem(spki);
  const privPem = pkcs8ToPem(pkcs8);
  // also export JWK for reliable import in Node tests
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicId = await compute6DigitId(spki);
  storage.set(STORAGE_KEYS.KEYS, {publicPem, privPem, publicJwk, privateJwk, publicId});
  return {publicPem, privPem, publicJwk, privateJwk, publicId};
}

async function compute6DigitId(spkiArrayBuffer){
  // hash spki and derive 6-digit numeric code
  const digest = await crypto.subtle.digest('SHA-256', spkiArrayBuffer);
  const bytes = new Uint8Array(digest);
  // use first 4 bytes to get a 32-bit number, mod 1_000_000
  const num = ((bytes[0]<<24) | (bytes[1]<<16) | (bytes[2]<<8) | bytes[3]) >>> 0;
  const code = (num % 1000000).toString().padStart(6,'0');
  return code;
}

async function importPublicKeyFromPem(pem){
  const ab = pemToArrayBuffer(pem);
  return crypto.subtle.importKey('spki', ab, {name:'RSA-OAEP', hash:'SHA-256'}, true, ['encrypt']);
}
async function importPrivateKeyFromPem(pem){
  const ab = pemToArrayBuffer(pem);
  return crypto.subtle.importKey('pkcs8', ab, {name:'RSA-OAEP', hash:'SHA-256'}, true, ['decrypt']);
}

// Hybrid encryption: encrypt payload with AES-GCM and encrypt AES key with RSA-OAEP
async function encryptForPem(pubPem, dataUint8Array){
  const rsaKey = await importPublicKeyFromPem(pubPem);
  // generate ephemeral AES key
  const aesKey = await crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);
  // encrypt payload with AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM', iv}, aesKey, dataUint8Array);
  // encrypt raw AES key with RSA-OAEP
  const encryptedKey = await crypto.subtle.encrypt({name:'RSA-OAEP'}, rsaKey, rawAes);
  const obj = {k: abToBase64(encryptedKey), iv: abToBase64(iv.buffer), d: abToBase64(ciphertext)};
  const json = JSON.stringify(obj);
  return abToBase64(textToAb(json));
}
async function decryptWithPrivatePem(privPemOrJwk, encryptedBase64){
  // support passing either a PEM string or a JWK object
  let rsaPriv;
  if (privPemOrJwk && typeof privPemOrJwk === 'object'){
    rsaPriv = await crypto.subtle.importKey('jwk', privPemOrJwk, {name:'RSA-OAEP', hash:'SHA-256'}, true, ['decrypt']);
  } else {
    rsaPriv = await importPrivateKeyFromPem(privPemOrJwk);
  }
  const jsonAb = base64ToAb(encryptedBase64);
  const jsonText = abToText(jsonAb);
  const obj = JSON.parse(jsonText);
  const encryptedKeyAb = base64ToAb(obj.k);
  const rawAes = await crypto.subtle.decrypt({name:'RSA-OAEP'}, rsaPriv, encryptedKeyAb);
  const iv = new Uint8Array(base64ToAb(obj.iv));
  const cipherAb = base64ToAb(obj.d);
  const aesKey = await crypto.subtle.importKey('raw', rawAes, {name:'AES-GCM'}, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({name:'AES-GCM', iv}, aesKey, cipherAb);
  return new Uint8Array(decrypted);
}

// ---- candidates import/export ----
async function importEncryptedCandidates(encryptedBase64, expectedHashHex){
  const keys = storage.get(STORAGE_KEYS.KEYS);
  if (!keys || (!keys.privPem && !keys.privateJwk)) throw new Error('Chaves da urna não encontradas.');
  const decBytes = await decryptWithPrivatePem(keys.privateJwk || keys.privPem, encryptedBase64);
  const text = new TextDecoder().decode(decBytes);
  const obj = JSON.parse(text);
  const computed = await hashJson(obj);
  const ok = computed === expectedHashHex;
  if (!ok) return {ok:false, computed, obj};
  // store candidates and apuracao key
  storage.set(STORAGE_KEYS.CANDIDATES, obj);
  // initialize tally structure
  const tally = {};
  for (const c of obj.candidates) tally[c.number] = 0;
  storage.set(STORAGE_KEYS.TALLY, tally);
  return {ok:true, computed, obj};
}

// ---- ballot / voting ----
function getCandidates(){
  return storage.get(STORAGE_KEYS.CANDIDATES) || {candidates:[], apuracao_public_key:null};
}
function getTally(){
  return storage.get(STORAGE_KEYS.TALLY) || {};
}
function inputNumber(number){
  const {candidates} = getCandidates();
  const cand = (candidates || []).find(c => c.number === String(number));
  return cand || null;
}
function confirmVote(number){
  const tally = getTally();
  const key = String(number);
  if (!(key in tally)) tally[key] = 0;
  tally[key] = tally[key] + 1;
  storage.set(STORAGE_KEYS.TALLY, tally);
  return tally;
}

// ---- export poll_report ----
async function exportPollReport(terminalId){
  const tally = getTally();
  const total = Object.values(tally).reduce((s,v)=>s+v,0);
  const report = {
    terminal_id: terminalId || 'terminal-01',
    type: 'poll_report',
    issued_at: (new Date()).toISOString(),
    tally,
    total
  };
  const candidates = storage.get(STORAGE_KEYS.CANDIDATES);
  if (!candidates || !candidates.apuracao_public_key) throw new Error('apuracao_public_key ausente');
  const reportJson = stableStringify(report);
  const hash = await hashJson(report);
  // encrypt with apuracao public key
  const encrypted = await encryptForPem(candidates.apuracao_public_key, new TextEncoder().encode(reportJson));
  return {encrypted, hash, report};
}

// ---- key helpers exposed ----
function getStoredKeys(){
  return storage.get(STORAGE_KEYS.KEYS);
}

// ---- session init/load ----
async function initIfNeeded(){
  let keys = storage.get(STORAGE_KEYS.KEYS);
  if (!keys){
    keys = await generateAndStoreKeys();
  }
  return keys;
}

// ---- exports ----
window.UrnaFrontendLogic = {
  // init
  initIfNeeded,
  getStoredKeys,
  // crypto/import
  generateAndStoreKeys,
  importEncryptedCandidates,
  // voting
  getCandidates,
  getTally,
  inputNumber,
  confirmVote,
  // export
  exportPollReport,
  // utils
  hashJson
};

// End of file
