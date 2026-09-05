# Urna / Lógica

Este diretório contém a lógica independente de UI da urna. O arquivo
`frontend-logic.js` expõe a API global `window.UrnaFrontendLogic` e é coberto por
`tests/run-tests.js`.

## Funcionalidades

- geração e persistência do código de 6 dígitos da urna;
- derivação de uma chave AES-256-GCM por SHA-256 do código;
- importação do `candidates.json` criptografado e verificação do hash;
- suporte aos campos `name_vice` e `photo_vice` (SVG inline);
- votação, contagem local e persistência do `tally`;
- exportação do `poll_report` criptografado com o mesmo código.

O envelope criptografado é base64 de um JSON com os campos `iv` e `d`. O
`candidates.json` não contém `apuracao_public_key`.

## API principal

- `initIfNeeded(): Promise<{code}>` gera o código quando necessário e retorna o código persistido.
- `getStoredCode()` retorna o código salvo.
- `generate6DigitCode()` gera um código; `generateAndStoreCode()` o persiste e
  limpa carga/contagem vinculadas ao código anterior.
- `keyFromCode(code)`, `encryptWithCode(code, plaintext)` e
  `decryptWithCode(code, envelope)` implementam a criptografia simétrica.
- `importEncryptedCandidates(envelope, expectedHash)` descriptografa, confere o
  SHA-256 e persiste os candidatos.
- `getCandidates()`, `getTally()`, `inputNumber(number)` e `confirmVote(number)`
  implementam o fluxo de votação.
- `exportPollReport(terminalId)` retorna `{encrypted, hash, report}`.

## Testes

Na raiz do repositório, execute:

```sh
node tests/run-tests.js
```

## Segurança

O código possui apenas 1.000.000 de combinações. A criptografia é adequada ao
escopo demonstrativo do projeto e não fornece confidencialidade forte contra força
bruta. O armazenamento local usa `localStorage` por simplicidade.
