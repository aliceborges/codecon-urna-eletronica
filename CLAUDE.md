# CLAUDE.md — Urna Codecon

Guia do projeto para quem for desenvolver. Dois serviços independentes, tudo **offline**, cada um com seu próprio front-end.

- **`urna/`** — front-end da urna de votação (onde o eleitor vota).
- **`apuracao/`** — serviço de apuração, dono dos cadastros e da consolidação final.

---

## Visão geral

A apuração é a dona dos cadastros (urnas e candidatos): ela exporta um JSON que a urna importa pra rodar a votação. A urna registra e conta os próprios votos e exporta o resultado. A apuração importa esse resultado, valida e declara o vencedor.

Fluxo de ponta a ponta:

1. A urna, ao abrir pela primeira vez, gera seu **par de chaves** e é cadastrada na apuração pela sua **chave pública de 6 dígitos**.
2. A apuração gera o cadastro (`candidates.json`) — que **inclui a chave pública da própria apuração** —, calcula o **hash do JSON original**, **criptografa com a chave pública da urna** e disponibiliza o arquivo criptografado + o hash.
3. A urna faz **upload** do arquivo criptografado, descriptografa com a **própria chave privada**, **confere o hash do JSON descriptografado** contra o informado (exibido na tela) e, se bater, **abre a votação**.
4. Eleitores votam; ao encerrar, a urna monta o boletim (`poll_report`), calcula o **hash do JSON original** e **criptografa com a chave pública da apuração** (recebida no `candidates.json`).
5. A apuração importa os boletins, descriptografa com a **própria chave privada**, **confere o hash do JSON descriptografado** (exibido na tela), consolida e **declara o vencedor**.

> Não há assinatura. A troca usa **criptografia assimétrica nos dois sentidos** (cada lado só lê com a própria chave privada) e o **hash é do JSON original (antes de criptografar)** — garante que o conteúdo real é válido, e fica visível para os usuários nas telas na hora de importar.

---

## Provisionamento da urna (chave pública + carga criptografada)

Etapa que acontece **antes** da votação, quando a urna é preparada.

1. **Primeira abertura da urna** — o front gera uma **chave pública de 6 dígitos**. Essa chave identifica a urna e é usada para criptografar a carga que ela vai receber.
2. **Cadastro no backend** — a chave pública de 6 dígitos é registrada na apuração, ligando aquela urna ao seu material de votação.
3. **Geração da carga** — a apuração monta o cadastro (`candidates.json`), inclui nele a **própria chave pública**, calcula o **hash do JSON original** e **criptografa usando a chave pública de 6 dígitos** daquela urna específica.
4. **Upload na urna** — a urna recebe (upload) o **arquivo criptografado** e o **hash**.
5. **Conferência** — a urna descriptografa com a **própria chave privada** e recalcula o hash do JSON obtido, comparando com o informado (**exibido na tela** para o usuário conferir). Batendo, **abre o processo de votação**; se não bater, recusa a carga.

> A chave de 6 dígitos é a chave pública da urna: fácil de digitar/conferir no cadastro, e é o que a apuração usa para criptografar a carga daquela urna. Só a urna, com sua chave privada, consegue abrir o arquivo — se alguém interceptar no caminho, não lê o conteúdo.

---

## Cadastro de candidatos (a apuração gera, a urna importa)

A apuração é a fonte única do cadastro. Ela exporta o `candidates.json` (criptografado para a urna, conforme acima), e a urna importa pra montar a cédula. O `number` é a chave que liga tudo: a urna registra o voto pelo número, o boletim conta por número, e o cadastro dá nome e imagem de cada número.

Além dos candidatos, o `candidates.json` carrega a **chave pública da apuração** (`apuracao_public_key`). A urna guarda essa chave e a usa no fim para **criptografar o boletim** (`poll_report`) de volta — assim só a apuração, com sua chave privada, consegue ler o retorno.

Contrato (`candidates.json`):

```json
{
  "apuracao_public_key": "7c1b...",
  "candidates": [
    {
      "number": "10",
      "name": "Nome do Candidato",
      "party": "Legenda",
      "photo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>...</svg>"
    }
  ]
}
```

`photo` é um SVG, renderizado **inline** pela urna (não dentro de um `<img>`), pra poder estilizar e animar junto do tema da urna.

`apuracao_public_key` é a chave pública da apuração que gerou a carga. A urna a usa para criptografar o `poll_report` no fim da votação.

---

## Serviço 1: Urna de votação (`urna/`)

Autônoma e offline. Gera seu par de chaves na primeira abertura (a pública tem 6 dígitos), importa a carga criptografada (conferindo o hash e descriptografando com a própria privada), recebe os votos, faz a própria contagem e, quando é encerrada, emite um boletim (`poll_report`) com o total dela.

Front-end: tela de votação, onde o eleitor escolhe o candidato pelo número e confirma vendo o nome e a imagem (o SVG do cadastro, renderizado inline).

No encerramento, a urna monta o `poll_report`, calcula o **hash do JSON original** e o **criptografa com a chave pública da apuração** (`apuracao_public_key`, recebida no `candidates.json`). Só a apuração, com sua chave privada, consegue abrir o retorno. Junto do arquivo criptografado vai o **hash do JSON original**, exibido na tela para conferência.

Conteúdo do boletim (`poll_report`) **antes de criptografar**:

```json
{
  "terminal_id": "terminal-01",
  "type": "poll_report",
  "issued_at": "2026-09-02T20:00:00Z",
  "tally": { "10": 12, "20": 9, "30": 5 },
  "total": 26
}
```

O que trafega é esse JSON **criptografado com a chave pública da apuração**, acompanhado do **hash do JSON original (antes de criptografar)** para conferência visual nas duas pontas.

---

## Serviço 2: Apuração (`apuracao/`)

Dona dos cadastros. Tem seu próprio par de chaves e injeta a **chave pública** (`apuracao_public_key`) no `candidates.json`. Registra as urnas (pela chave pública de 6 dígitos), exporta o `candidates.json` criptografado que a urna consome, e no fim importa os `poll_report` de todas as urnas. Para cada boletim, **descriptografa com a própria chave privada** e **confere o hash do JSON obtido** (exibido na tela); só então consolida e declara o vencedor.

Front-end: tela de apuração, onde os votos aparecem sendo contados e no fim aparece o nome e a imagem do vencedor. Vale colocar um delay/suspense na contagem em vez de já cuspir o número de uma vez, fica bem melhor de assistir.

Contrato de saída (`consolidated_report`):

```json
{
  "type": "consolidated_report",
  "issued_at": "2026-09-02T21:10:00Z",
  "tally": { "10": 40, "20": 33, "30": 18 },
  "winner": "10",
  "total": 91
}
```

---

## Princípios

- **Offline**: os dois serviços operam sem depender de rede entre si; a troca é por arquivos (export/import).
- **`number` como chave**: liga cadastro, voto e boletim.
- **Sigilo nos dois sentidos**: toda troca é criptografada com a chave pública do destinatário (apuração→urna com a pública da urna; urna→apuração com a pública da apuração). Cada lado só lê com a própria chave privada; quem interceptar no caminho não vê o conteúdo.
- **Integridade por hash**: o hash é sempre do **JSON original (antes de criptografar)**, garantindo que o conteúdo real é válido. Trafega junto do arquivo e é **exibido nas telas** para conferência visual na hora de importar, nas duas pontas. Não há assinatura.
- **Front-ends separados**: `urna/` e `apuracao/` são independentes.
