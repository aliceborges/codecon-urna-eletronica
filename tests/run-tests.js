const fs = require('fs');
const path = require('path');
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
function stableStringify(obj){
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

async function keyFromCode(code){
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(code)));
  return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}

async function encryptWithCode(code, plainText){
  const key = await keyFromCode(code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const d = await crypto.subtle.encrypt(
    {name:'AES-GCM', iv},
    key,
    new TextEncoder().encode(plainText)
  );
  const obj = {iv: abToBase64(iv.buffer), d: abToBase64(d)};
  return abToBase64(new TextEncoder().encode(JSON.stringify(obj)));
}

async function decryptWithCode(code, encryptedBase64){
  const key = await keyFromCode(code);
  const jsonAb = base64ToAb(encryptedBase64);
  const jsonText = Buffer.from(jsonAb).toString();
  const obj = JSON.parse(jsonText);
  const iv = new Uint8Array(base64ToAb(obj.iv));
  const decrypted = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, base64ToAb(obj.d));
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
  const sourcePath = path.join(__dirname, '..', 'urna', 'logica', 'frontend-logic.js');
  const sourceCode = fs.readFileSync(sourcePath, 'utf8');
  vm.runInThisContext(sourceCode, {filename:'frontend-logic.js'});
  const U = globalThis.window.UrnaFrontendLogic;
  assert(U, 'UrnaFrontendLogic should be loaded');

  console.log('1) Testing hashJson deterministic output');
  const obj = {b:2,a:1};
  const h = await U.hashJson(obj);
  assert.strictEqual(typeof h, 'string');
  assert.strictEqual(h.length, 64);

  console.log('2) Testing generation and persistence of the 6-digit code');
  localStorage.setItem('urna:keys', JSON.stringify({publicPem:'legacy'}));
  localStorage.setItem('urna:candidates', JSON.stringify({candidates:[{number:'123'}]}));
  const initialized = await U.initIfNeeded();
  const code = U.getStoredCode();
  assert(code && /^\d{6}$/.test(code));
  assert.strictEqual(initialized.code, code);
  assert.strictEqual((await U.initIfNeeded()).code, code, 'init should reuse the stored code');
  assert.strictEqual(localStorage.getItem('urna:keys'), null, 'legacy RSA keys should not remain');
  assert.deepStrictEqual(U.getCandidates().candidates, [], 'a new code should clear the old load');

  console.log('3) Testing AES-GCM candidate import with the new schema');
  const candidatesObj = {
    candidates:[{
      number:'123',
      name:'Alice',
      party:'X',
      photo:'<svg></svg>',
      name_vice:'Nome Vice',
      photo_vice:'<svg><title>Vice</title></svg>'
    }]
  };
  const candidatesJson = stableStringify(candidatesObj);
  // compute hash using same stableStringify -> SHA-256 hex
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(candidatesJson));
  const expectedHashHex = Buffer.from(digest).toString('hex');

  const encrypted = await encryptWithCode(code, candidatesJson);
  const envelope = JSON.parse(Buffer.from(base64ToAb(encrypted)).toString());
  assert.deepStrictEqual(Object.keys(envelope).sort(), ['d', 'iv']);

  const rejected = await U.importEncryptedCandidates(encrypted, '0'.repeat(64));
  assert.strictEqual(rejected.ok, false, 'a divergent hash should reject the candidate load');
  assert.deepStrictEqual(U.getCandidates().candidates, []);

  const res = await U.importEncryptedCandidates(encrypted, expectedHashHex);
  assert.strictEqual(res.ok, true, 'importEncryptedCandidates should succeed');
  // ensure vice fields passed through
  const importedCandidate = U.getCandidates().candidates[0];
  assert.strictEqual(importedCandidate.name_vice, 'Nome Vice');
  assert.strictEqual(importedCandidate.photo_vice, '<svg><title>Vice</title></svg>');
  assert.strictEqual('apuracao_public_key' in U.getCandidates(), false);

  const invalidCandidates = {candidates:[{...candidatesObj.candidates[0], number:'12'}]};
  const invalidCandidatesJson = stableStringify(invalidCandidates);
  const invalidDigest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(invalidCandidatesJson)
  );
  const invalidEncrypted = await encryptWithCode(code, invalidCandidatesJson);
  await assert.rejects(
    () => U.importEncryptedCandidates(invalidEncrypted, Buffer.from(invalidDigest).toString('hex')),
    /exatamente 3 dígitos/
  );

  console.log('4) Testing vote flow and tally persistence');
  const cand = U.inputNumber('123');
  assert(cand && cand.name === 'Alice');
  assert.strictEqual(U.inputNumber('12'), null);
  assert.throws(() => U.confirmVote('12'), /3 dígitos/);
  assert.throws(() => U.confirmVote('999'), /inválido/);
  const tally1 = U.confirmVote('123');
  assert.strictEqual(tally1['123'], 1);
  const tally2 = U.confirmVote('123');
  assert.strictEqual(tally2['123'], 2);

  console.log('5) Testing poll report export with the same 6-digit code');
  const out = await U.exportPollReport('terminal-test');
  assert(out && out.encrypted && out.hash && out.report);
  const reportEnvelope = JSON.parse(Buffer.from(base64ToAb(out.encrypted)).toString());
  assert.deepStrictEqual(Object.keys(reportEnvelope).sort(), ['d', 'iv']);
  const decrypted = await decryptWithCode(code, out.encrypted);
  const parsed = JSON.parse(decrypted);
  assert.deepStrictEqual(parsed.tally, out.report.tally);
  // verify hash matches
  const computedHash = await U.hashJson(out.report);
  assert.strictEqual(computedHash, out.hash);

  const wrongCode = String((Number(code) + 1) % 1000000).padStart(6, '0');
  await assert.rejects(() => decryptWithCode(wrongCode, out.encrypted));

  console.log('All tests passed');
}

run().catch(err => {
  console.error('Tests failed:', err);
  process.exit(1);
});
