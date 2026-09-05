const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');
const crypto = webcrypto;

function abToBase64(buf) {
  return Buffer.from(buf).toString('base64');
}
function base64ToAb(b64){
  return Buffer.from(b64, 'base64');
}
function textToAb(str){ return new TextEncoder().encode(str).buffer; }
function abToText(buf){ return new TextDecoder().decode(buf); }
function stableStringify(obj){
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function arrayBufferToPem(spkiBuffer, label){
  const b64 = abToBase64(spkiBuffer);
  const lines = b64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}
function pemToArrayBuffer(pem){
  const b64 = pem.replace(/-----.*?-----|\n|\r/g,'');
  return base64ToAb(b64);
}

async function importPublicKeyFromPem(pem){
  const ab = pemToArrayBuffer(pem);
  return crypto.subtle.importKey('spki', ab, {name:'RSA-OAEP', hash:'SHA-256'}, true, ['encrypt']);
}
async function importPrivateKeyFromPem(pkcs8Pem){
  const ab = pemToArrayBuffer(pkcs8Pem);
  return crypto.subtle.importKey('pkcs8', ab, {name:'RSA-OAEP', hash:'SHA-256'}, true, ['decrypt']);
}

async function encryptWithPubPem(pem, plainText){
  const rsaKey = await importPublicKeyFromPem(pem);
  // generate AES key
  const aesKey = await crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM', iv}, aesKey, new TextEncoder().encode(plainText));
  const encryptedKey = await crypto.subtle.encrypt({name:'RSA-OAEP'}, rsaKey, rawAes);
  const obj = {k: abToBase64(encryptedKey), iv: abToBase64(iv.buffer), d: abToBase64(ciphertext)};
  return abToBase64(new TextEncoder().encode(JSON.stringify(obj)));
}
async function decryptWithPrivPem(pkcs8Pem, encryptedBase64){
  const rsaPriv = await importPrivateKeyFromPem(pkcs8Pem);
  const jsonAb = base64ToAb(encryptedBase64);
  const jsonText = Buffer.from(jsonAb).toString();
  const obj = JSON.parse(jsonText);
  const encryptedKeyAb = base64ToAb(obj.k);
  const rawAes = await crypto.subtle.decrypt({name:'RSA-OAEP'}, rsaPriv, encryptedKeyAb);
  const iv = new Uint8Array(base64ToAb(obj.iv));
  const cipherAb = base64ToAb(obj.d);
  const aesKey = await crypto.subtle.importKey('raw', rawAes, {name:'AES-GCM'}, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({name:'AES-GCM', iv}, aesKey, cipherAb);
  return new TextDecoder().decode(decrypted);
}

async function run(){
  // Provide webcrypto and window for the evaluated script
  globalThis.crypto = crypto;
  if (typeof TextEncoder === 'undefined') globalThis.TextEncoder = require('util').TextEncoder;
  if (typeof TextDecoder === 'undefined') globalThis.TextDecoder = require('util').TextDecoder;
  // minimal localStorage polyfill for tests
  globalThis.localStorage = (function(){ const store = {}; return { getItem(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; }, setItem(k,v){ store[k]=String(v); }, removeItem(k){ delete store[k]; } }; })();
  globalThis.window = { localStorage: globalThis.localStorage };
  const code = fs.readFileSync('urna/logica/frontend-logic.js', 'utf8');
  vm.runInThisContext(code, {filename:'frontend-logic.js'});
  const U = globalThis.window.UrnaFrontendLogic;
  assert(U, 'UrnaFrontendLogic should be loaded');

  console.log('1) Testing hashJson deterministic output');
  const obj = {b:2,a:1};
  const h = await U.hashJson(obj);
  assert.strictEqual(typeof h, 'string');
  assert.strictEqual(h.length, 64);

  console.log('2) Testing key generation and 6-digit public id');
  await U.initIfNeeded();
  const keys = U.getStoredKeys();
  assert(keys && keys.publicPem && keys.privPem && keys.publicId);
  assert.strictEqual(keys.publicId.length, 6);

  console.log('3) Testing importEncryptedCandidates flow');
  // generate apuracao key pair
  const apPair = await crypto.subtle.generateKey(
    {name:'RSA-OAEP', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'},
    true,
    ['encrypt','decrypt']
  );
  const apSpki = await crypto.subtle.exportKey('spki', apPair.publicKey);
  const apPkcs8 = await crypto.subtle.exportKey('pkcs8', apPair.privateKey);
  const apPubPem = arrayBufferToPem(apSpki, 'PUBLIC KEY');
  const apPrivPem = arrayBufferToPem(apPkcs8, 'PRIVATE KEY');

  const candidatesObj = { apuracao_public_key: apPubPem, candidates:[{number:'10', name:'Alice', party:'X', photo:'<svg/>', name_vice: 'NomeVice', party_vice: 'PartidoVice', photo_vice: '<svg/vice/>'}] };
  const candidatesJson = stableStringify(candidatesObj);
  // compute hash using same stableStringify -> SHA-256 hex
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(candidatesJson));
  const expectedHashHex = Buffer.from(digest).toString('hex');

  // encrypt the candidates JSON with the urn public key
  const urnKeys = U.getStoredKeys();
  const urnPubPem = urnKeys.publicPem;
  const encrypted = await encryptWithPubPem(urnPubPem, candidatesJson);

  const res = await U.importEncryptedCandidates(encrypted, expectedHashHex);
  assert.strictEqual(res.ok, true, 'importEncryptedCandidates should succeed');
  // ensure vice fields passed through
  const importedCandidate = U.getCandidates().candidates[0];
  assert.strictEqual(importedCandidate.name_vice, 'NomeVice');
  assert.strictEqual(importedCandidate.party_vice, 'PartidoVice');
  assert.strictEqual(importedCandidate.photo_vice, '<svg/vice/>');

  console.log('4) Testing vote flow and tally persistence');
  const cand = U.inputNumber('10');
  assert(cand && cand.name === 'Alice');
  const tally1 = U.confirmVote('10');
  assert.strictEqual(tally1['10'], 1);
  const tally2 = U.confirmVote('10');
  assert.strictEqual(tally2['10'], 2);

  console.log('5) Testing exportPollReport and decrypt with apuracao private key');
  const out = await U.exportPollReport('terminal-test');
  assert(out && out.encrypted && out.hash && out.report);
  // decrypt using apuracao private key
  const decrypted = await decryptWithPrivPem(apPrivPem, out.encrypted);
  const parsed = JSON.parse(decrypted);
  assert.deepStrictEqual(parsed.tally, out.report.tally);
  // verify hash matches
  const computedHash = await U.hashJson(out.report);
  assert.strictEqual(computedHash, out.hash);

  console.log('All tests passed');
}

run().catch(err => {
  console.error('Tests failed:', err);
  process.exit(1);
});
