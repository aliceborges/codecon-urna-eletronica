# Frontend Logic — Especificação

Objetivo

Descrever a parte de lógica do frontend (urna) — separada do markup/estilos — que implementa o fluxo de provisionamento, votação, contagem local, import/export e criptografia/hash conforme CLAUDE.md.

Escopo

- Geração e armazenamento do par de chaves da urna (pública 6 dígitos e privada).
- Importação do arquivo criptografado de `candidates.json`, descriptografia, validação do hash e parsing do cadastro.
- Exposição de dados para a UI (candidatos com SVG inline) via stores/serviços.
- Fluxo de votação: digitar número, validar, confirmar, persistir voto temporariamente, cancelar/editar antes da confirmação.
- Contagem local (tally) e persistência local segura do estado da urna durante a sessão.
- Montagem do `poll_report`, cálculo do hash do JSON original e criptografia com `apuracao_public_key` para export.
- Tratamento de erros, mensagens para o usuário e UX de conferência (exibir hashes, confirmação de import/export).
- Testes unitários para serviços críticos (crypto, hash, ballot, fileIO).

Módulos sugeridos

- services/crypto.js (geração de chaves, encriptação/desencriptação assimétrica, utilitários de formato)
- services/hash.js (calcular/verificar hash do JSON original — SHA-256 ou similar)
- services/fileio.js (import/export de arquivos, parsing seguro, validação de formato)
- services/storage.js (abstração de storage local: localStorage / IndexedDB / filesystem conforme plataforma)
- services/ballot.js (fluxo de votação, validação de números, confirmação, contagem)
- stores/sessionStore.js (estado reativo para UI: status da carga, candidatos, votos, tally, hashes exibíveis)
- tests/* (testes unitários por serviço)

Contratos JSON

- candidates.json (fornecido pela apuração, depois de descriptografado):

```json
{
  "apuracao_public_key": "7c1b...",
  "candidates": [
    {
      "number": "10",
      "name": "Nome",
      "party": "Legenda",
      "photo": "<svg>...</svg>",
      "name_vice": "Nome do Vice (opcional)",
      "party_vice": "Partido do Vice (opcional)",
      "photo_vice": "<svg>...</svg> (opcional)"
    }
  ]
}
```

Observação: Para compatibilidade com cargas antigas, caso o arquivo use o campo photo_vice como CSV no formato "Nome,Partido" (em vez do SVG), a urna tenta parsear esse valor para preencher name_vice e party_vice automaticamente.

- poll_report (antes de criptografar):

```json
{
  "terminal_id": "terminal-01",
  "type": "poll_report",
  "issued_at": "2026-09-02T20:00:00Z",
  "tally": { "10": 12, "20": 9 },
  "total": 21
}
```

Fluxos principais

1. Provisionamento
- Gerar par de chaves na primeira abertura.
- Exibir chave pública de 6 dígitos para cadastro no backend.

2. Importar carga (candidates.json)
- Receber arquivo e hash informado.
- Descriptografar usando chave privada.
- Calcular hash do JSON obtido e comparar com o hash recebido.
- Ao confirmar, salvar candidatos e apuracao_public_key no storage e abrir votação.

3. Votação
- Receber entrada por número, mostrar pré-visualização (nome, SVG), permitir confirmar/corrigir.
- Ao confirmar, incrementar contagem local e persistir estado.

4. Encerramento/export
- Montar poll_report, calcular hash do JSON original, criptografar com apuracao_public_key.
- Exportar arquivo criptografado + hash para o usuário.

Critérios de aceite

- Geração e persistência das chaves funcionando (pública de 6 dígitos + privada).
- Importação de carga descriptografada que valida o hash exibido na UI.
- Votação com contagem local consistente e persistida entre recargas (quando aplicável).
- Exportação de poll_report criptografado corretamente e com hash calculado e exibido.
- Testes unitários cobrindo crypto, hash e ballot com cobertura mínima aceitável.

Tarefas sugeridas (para tracker)

- Escrever testes unitários para serviços críticos.
- Implementar services/crypto.js (API: generateKeys(), encryptFor(pub), decryptWithPriv()).
- Implementar services/hash.js (hashJson(json) -> hex).
- Implementar services/fileio.js (importEncryptedCandidates(file, expectedHash), exportEncryptedPollReport(report, apuracaoPubKey)).
- Implementar services/storage.js (get/set para candidatos, keys, tally).
- Implementar services/ballot.js (inputNumber, confirmVote, getTally).
- Integrar com stores/sessionStore.js para expor estado à UI.

Observações

- Manter separação clara UI vs lógica: os componentes visuais (markup/estilos) consomem apenas stores/serviços.
- Preferir APIs síncronas para operações leves e Promises/async para IO e crypto.
- Documentar pontos de extensão (por ex., troca de algoritmo de hash).

