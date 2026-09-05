README — Urna / Lógica

Visão geral

Este diretório contém a lógica de frontend da urna (urna/logica/frontend-logic.js). É independente da UI: expõe uma API global (window.UrnaFrontendLogic) que o front consome. Também há testes em tests/run-tests.js e um script npm test.

Funcionalidades

- Geração e persistência de chaves (RSA-OAEP + JWK) e ID público de 6 dígitos
- Importação de carga criptografada (candidates.json) com verificação de hash
- Suporte ao campo photo_vice no candidates.json (CSV com info do vice)
- Fluxo de votação: inputNumber(), confirmVote(), contagem local (tally)
- Exportação do poll_report (criptografado com a chave pública da apuração) com hash
- Persistência via localStorage (chaves, candidatos, tally)

Pré-requisitos

- Node.js v16+ para executar os testes (usa crypto.webcrypto)

Como rodar os testes

1. Do diretório raiz do projeto:
   npm install --no-package-lock --no-audit --no-fund || true
   npm test

Explicação curta dos testes:
- tests/run-tests.js carrega frontend-logic.js em um VM, fornece polyfills mínimos (localStorage, TextEncoder/TextDecoder) e valida crypto/hash/import/export/vote flows.

API principal (window.UrnaFrontendLogic)

- initIfNeeded(): Promise<{publicPem, privPem, publicJwk, privateJwk, publicId}>
  - Gera e armazena chaves se ausentes. publicId é a chave pública de 6 dígitos exibida ao usuário.

- getStoredKeys(): retorna o objeto salvo com chaves e publicId

- importEncryptedCandidates(encryptedBase64, expectedHashHex): Promise<{ok, computed, obj}>
  - Descriptografa com a chave privada da urna, valida o hash (SHA-256 hex) e grava candidatos + apuracao_public_key no storage.
  - candidates.json aceita o novo campo photo_vice além de photo.

- getCandidates(), getTally(), inputNumber(number), confirmVote(number)
  - Fluxo de votação e persistência da contagem.

- exportPollReport(terminalId): Promise<{encrypted, hash, report}>
  - Monta report, calcula hash (SHA-256 hex) e retorna o payload criptografado com a apuracao_public_key (formato híbrido AES-GCM + RSA-OAEP).

Integração com o frontend (sugestão)

- Opção 1 (incluir script direto): carregar urna/logica/frontend-logic.js antes da app e usar window.UrnaFrontendLogic nas views.

- Opção 2 (ES module wrapper): escrever um wrapper minimal que importa/encapsula a API e converte chamadas para Promises/observables usadas pelo framework (React/Vue/Svelte).

Exemplo mínimo (browser):

<script src="/urna/logica/frontend-logic.js"></script>
<script>
  (async ()=>{
    await window.UrnaFrontendLogic.initIfNeeded();
    const keys = window.UrnaFrontendLogic.getStoredKeys();
    console.log('Urna ID:', keys.publicId);
  })();
</script>

Notas de segurança

- Todo o tráfego de arquivos entre apuração e urna usa criptografia assimétrica. Hashes exibidos na UI são a forma de conferir integridade.
- O armazenamento local usa localStorage por simplicidade. Para produção, considere IndexedDB com criptografia ao repouso.

Como criar um script de integração futura

- Escrever um script/node module que importe o arquivo (ou carregue em VM) e exponha funções CLI para: gerar chaves, empacotar candidates.json (criptografar com chave da urna), importar resultados, e exportar poll_report. tests/run-tests.js pode ser referência.

Contato

- Implementado por Copilot CLI (ajustes locais podem ser necessários).
