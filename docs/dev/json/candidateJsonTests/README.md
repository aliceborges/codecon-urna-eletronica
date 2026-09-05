# Fixtures — candidates.json (apuração → urna)

Arquivos de teste válidos, **gerados pelo apuração**, no formato que a urna importa.

Todos são da **Urna 1**, cuja chave de 6 dígitos é **`768599`**. A criptografia é
simétrica (AES-256-GCM com a chave derivada de `SHA-256("768599")`); o hash é
`SHA-256` sobre a serialização canônica (chaves ordenadas).

## Arquivos

- **`candidates-urna-768599.enc.json`** — o que trafega de verdade:
  ```json
  { "urna": "Urna 1", "encrypted": "<base64>", "hash": "<sha256>" }
  ```
  A urna importa com `importEncryptedCandidates(encrypted, hash)`: decifra com a
  própria chave de 6 dígitos, confere o `hash` e abre a votação.

- **`candidates-urna-768599.plaintext.json`** — o conteúdo **já decifrado**, só para
  inspeção/validação (não é o que se envia). Schema de cada candidato:
  ```json
  { "number": "500", "name": "Gabi", "party": "...",
    "photo": "<svg…>", "name_vice": "…", "photo_vice": "<svg…>" }
  ```

## Como testar na urna

1. A urna precisa ter a chave **`768599`** (esquema simétrico do `docs/plan/ajuste-criptografia-front.md`).
2. Passe `encrypted` e `hash` do `.enc.json` para `importEncryptedCandidates(encrypted, hash)`.
3. O hash exibido deve bater com o do arquivo.

> Se a chave da Urna 1 mudar no cadastro, regenere estes arquivos (exporte de novo
> em `/admin/urnas/{id}/carga`), pois eles são cifrados para a chave `768599`.
