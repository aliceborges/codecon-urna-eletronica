// frontend-logic.js
// Serviços essenciais para a urna: geração do código, import de carga, verificação de hash,
// fluxo de votação (input/confirm), contagem local e export do poll_report.
// Usa Web Crypto API e localStorage para persistência simples.

const STORAGE_KEYS = {
  CODE: 'urna:code',
  CANDIDATES: 'urna:candidates',
  TALLY: 'urna:tally',
  SESSION: 'urna:session'
};
const LEGACY_KEYS_STORAGE_KEY = 'urna:keys';

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

// ---- crypto service (shared code + encrypt/decrypt) ----
function generate6DigitCode(){
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, '0');
}

function generateAndStoreCode(){
  const code = generate6DigitCode();
  storage.set(STORAGE_KEYS.CODE, code);
  storage.remove(LEGACY_KEYS_STORAGE_KEY);
  storage.remove(STORAGE_KEYS.CANDIDATES);
  storage.remove(STORAGE_KEYS.TALLY);
  return code;
}

async function keyFromCode(code){
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(code)));
  return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}

async function encryptWithCode(code, plaintext){
  const key = await keyFromCode(code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const d = await crypto.subtle.encrypt(
    {name:'AES-GCM', iv},
    key,
    new TextEncoder().encode(plaintext)
  );
  const obj = {iv: abToBase64(iv.buffer), d: abToBase64(d)};
  return abToBase64(new TextEncoder().encode(JSON.stringify(obj)));
}

async function decryptWithCode(code, envelopeBase64){
  const key = await keyFromCode(code);
  const obj = JSON.parse(new TextDecoder().decode(base64ToAb(envelopeBase64)));
  const iv = new Uint8Array(base64ToAb(obj.iv));
  const dec = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, base64ToAb(obj.d));
  return new TextDecoder().decode(dec);
}

// ---- candidates import/export ----
async function importEncryptedCandidates(encryptedBase64, expectedHashHex){
  const code = getStoredCode();
  if (!code) throw new Error('Código da urna não encontrado.');
  const text = await decryptWithCode(code, encryptedBase64);
  const obj = JSON.parse(text);
  const computed = await hashJson(obj);
  const ok = computed === String(expectedHashHex).trim().toLowerCase();
  if (!ok) return {ok:false, computed, obj};
  if (!Array.isArray(obj.candidates)) throw new Error('Carga de candidatos inválida.');
  obj.candidates = obj.candidates.map(c => {
    const candidate = Object.assign({}, c);
    if (candidate.number !== undefined) candidate.number = String(candidate.number);
    if (!/^\d{3}$/.test(candidate.number || '')) {
      throw new Error('Todos os números de chapa devem ter exatamente 3 dígitos.');
    }
    return candidate;
  });
  storage.set(STORAGE_KEYS.CANDIDATES, obj);
  // initialize tally structure
  const tally = {};
  for (const c of obj.candidates) tally[c.number] = 0;
  storage.set(STORAGE_KEYS.TALLY, tally);
  return {ok:true, computed, obj};
}

// ---- ballot / voting ----
function getCandidates(){
  return storage.get(STORAGE_KEYS.CANDIDATES) || {candidates:[]};
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
  if (key !== 'blank' && (!/^\d{3}$/.test(key) || !inputNumber(key))) {
    throw new Error('Número de chapa inválido. Informe os 3 dígitos de um candidato.');
  }
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
  const code = getStoredCode();
  if (!code) throw new Error('Código da urna não encontrado.');
  const reportJson = stableStringify(report);
  const hash = await hashJson(report);
  const encrypted = await encryptWithCode(code, reportJson);
  return {encrypted, hash, report};
}

// ---- code helpers exposed ----
function getStoredCode(){
  const code = storage.get(STORAGE_KEYS.CODE);
  return typeof code === 'string' && /^\d{6}$/.test(code) ? code : null;
}

// ---- session init/load ----
async function initIfNeeded(){
  let code = getStoredCode();
  if (!code) code = generateAndStoreCode();
  storage.remove(LEGACY_KEYS_STORAGE_KEY);
  return {code};
}

// ---- exports ----
window.UrnaFrontendLogic = {
  // init
  initIfNeeded,
  getStoredCode,
  // crypto/import
  generate6DigitCode,
  generateAndStoreCode,
  keyFromCode,
  encryptWithCode,
  decryptWithCode,
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
