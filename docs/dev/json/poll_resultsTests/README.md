# Fixtures — poll_report (urna → apuração)

Boletim de teste da **mesma urna** (Urna 1, chave **`768599`**) para testar a
importação em `/admin/urnas/{id}/boletim`.

Cifrado com a chave de 6 dígitos da urna (AES-256-GCM); hash `SHA-256` sobre a
serialização canônica.

## Arquivos

- **`poll_report-urna-768599.enc.json`** — o que se importa:
  ```json
  { "encrypted": "<base64>", "hash": "<sha256>" }
  ```
- **`poll_report-urna-768599.plaintext.json`** — conteúdo decifrado, para referência:
  ```json
  {
    "terminal_id": "urna-1",
    "type": "poll_report",
    "issued_at": "2026-09-05T21:30:00Z",
    "tally": { "500": 32, "418": 15, "301": 28, "403": 12, "408": 18 },
    "total": 105
  }
  ```

**Total: 105 votos** distribuídos entre os 5 candidatos.

## Como testar a importação

1. Admin → **Urnas** → **Receber boletim** (na Urna 1).
2. Envie o `poll_report-urna-768599.enc.json`.
3. A tela decifra com a chave `768599`, mostra o **hash para conferência** e os
   votos por número (total 105). O hash deve bater (`Hash confere`).
4. **Aceitar** grava o boletim.

> Cifrado para a chave `768599`. Se a chave da Urna 1 mudar, regenere o arquivo.
