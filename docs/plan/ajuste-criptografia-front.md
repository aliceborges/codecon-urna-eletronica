# Ajuste de criptografia e schema — carga da urna

Documento de alinhamento entre **apuração** e **urna**. Descreve a mudança no esquema de
criptografia (de RSA para simétrico baseado no código de 6 dígitos) e a padronização dos
campos do `candidates.json`.

> Público-alvo: equipe da urna (`urna/logica/frontend-logic.js` e `urna/src/App.vue`).

---

## 1. Objetivo

Simplificar toda a troca de arquivos entre apuração e urna para girar em torno do
**código de 6 dígitos da urna**, eliminando a troca de chaves PEM/RSA.

O código de 6 dígitos passa a ser a **chave compartilhada** entre aquela urna e a apuração.
A mesma chave é usada nos dois sentidos:

- **apuração → urna**: `candidates.json` (criptografado)
- **urna → apuração**: `poll_report` (criptografado)

---

## 2. Premissa de segurança (importante)

O código de 6 dígitos tem apenas **1.000.000 de combinações**. Isso significa que este
esquema é **grau-demonstração**: quem interceptar um arquivo consegue quebrá-lo por força
bruta rapidamente. É uma decisão consciente para o escopo atual do projeto.

- **Integridade** continua garantida/conferível pelo **hash SHA-256** exibido nas telas.
- **Confidencialidade forte não é objetivo** nesta fase. Fortalecer o esquema (KDF com
  salt/iterações, chaves maiores, etc.) fica como evolução futura.

---

## 3. Criptografia: trocar RSA por AES-GCM derivado dos 6 dígitos

Remover o esquema híbrido RSA-OAEP + as helpers de PEM. Passar a usar **AES-256-GCM** com a
chave derivada do código de 6 dígitos.

### 3.1. Derivação da chave (idêntica nos dois lados)

```js
async function keyFromCode(code) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(code)));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
```

### 3.2. Envelope (formato do arquivo trafegado)

O payload criptografado é **base64 de um JSON** com `iv` e `d`:

```js
// helpers de base64 já existentes no projeto (abToBase64 / base64ToAb)

async function encryptWithCode(code, plaintext) {
  const key = await keyFromCode(code);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const d   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const obj = { iv: abToBase64(iv.buffer), d: abToBase64(d) };
  return abToBase64(new TextEncoder().encode(JSON.stringify(obj)));
}

async function decryptWithCode(code, envelopeBase64) {
  const key = await keyFromCode(code);
  const obj = JSON.parse(new TextDecoder().decode(base64ToAb(envelopeBase64)));
  const iv  = new Uint8Array(base64ToAb(obj.iv));
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToAb(obj.d));
  return new TextDecoder().decode(dec);
}
```

> Diferença para o envelope atual: **sai o campo `k`** (chave AES embrulhada com RSA).
> Ficam apenas `iv` e `d`.

### 3.3. Código de 6 dígitos

Como não há mais chave RSA para derivar o código, a urna passa a **gerar/armazenar um
código de 6 dígitos** (pode ser aleatório) na primeira execução e exibi-lo ao operador.
Esse código é o que o operador informa à apuração no cadastro da urna.

```js
function generate6DigitCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, '0');
}
```

---

## 4. Impacto nas funções do `frontend-logic.js`

| Função | Antes | Depois |
|---|---|---|
| `generateAndStoreKeys` / `initIfNeeded` | Gera par RSA + `publicId` derivado | Gera e guarda o **código de 6 dígitos** (chave compartilhada) |
| `importEncryptedCandidates(envelope, hash)` | RSA-decrypt com chave privada da urna | `decryptWithCode(codigo, envelope)` → valida hash SHA-256 |
| `exportPollReport(terminalId)` | RSA-encrypt com `apuracao_public_key` | `encryptWithCode(codigo, reportJson)` — **não usa mais `apuracao_public_key`** |
| helpers `spkiToPem`/`pkcs8ToPem`/`pemToArrayBuffer`/`importPublicKeyFromPem`/… | — | **podem ser removidas** |

Observações:

- O **hash** continua igual: `SHA-256` hex sobre `stableStringify(obj)`.
- O campo **`apuracao_public_key` sai** do `candidates.json` (não é mais necessário).
- O `poll_report` continua com os campos `{ terminal_id, type, issued_at, tally, total }`,
  agora criptografado com a chave dos 6 dígitos.

---

## 5. Schema do `candidates.json` (padronização de campos)

A apuração já possui os dados (inclusive **foto do vice**). Padronizar assim:

```json
{
  "candidates": [
    {
      "number": "10",
      "name": "Ana Titular",
      "party": "Partido Azul",
      "photo": "<svg ...>...</svg>",
      "name_vice": "Beto Vice",
      "photo_vice": "<svg ...>...</svg>"
    }
  ]
}
```

Mudanças em relação ao que a urna consome hoje:

- **`photo_vice`** passa a ser o **SVG do vice** (hoje é usado como CSV `"nome,partido"`).
- Entra o campo **`name_vice`** (nome do vice).
- Mantém-se: `number` (string), `name`, `party`, `photo` (SVG inline).

### 5.1. Ajuste no `App.vue`

- Renderizar `photo_vice` **inline como SVG** (mesmo tratamento do `photo`).
- Exibir `name_vice` como o nome do vice.
- Remover o parsing de CSV (`split(',')`) do vice.

---

## 6. Checklist para a equipe da urna

- [ ] Adicionar `keyFromCode`, `encryptWithCode`, `decryptWithCode`, `generate6DigitCode`.
- [ ] Trocar geração de chaves por geração/armazenamento do código de 6 dígitos.
- [ ] Reescrever `importEncryptedCandidates` usando `decryptWithCode`.
- [ ] Reescrever `exportPollReport` usando `encryptWithCode` (remover uso de `apuracao_public_key`).
- [ ] Remover helpers RSA/PEM não usadas.
- [ ] Atualizar o `App.vue`: `photo_vice` como SVG + exibir `name_vice`.
- [ ] Atualizar os testes (`tests/run-tests.js`) para o novo envelope e schema.

---

## 7. Fluxo resultante (resumo)

1. Urna gera seu **código de 6 dígitos** e exibe ao operador.
2. Operador informa o código à apuração (cadastro da urna).
3. Apuração monta o `candidates.json`, calcula o **hash** e **criptografa com o código** → envia arquivo + hash.
4. Urna **descriptografa com o código**, confere o hash e abre a votação.
5. Ao encerrar, a urna monta o `poll_report`, calcula o hash e **criptografa com o mesmo código**.
6. Apuração **descriptografa com o código** daquela urna, confere o hash e consolida.
