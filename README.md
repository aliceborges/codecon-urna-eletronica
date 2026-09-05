# Urna Codecon

Guia do projeto para quem for desenvolver. Dois serviços independentes, tudo **offline**, cada um com seu próprio front-end.

- **`urna/`** — front-end da urna de votação (onde o eleitor vota).
- **`apuracao/`** — serviço de apuração, dono dos cadastros e da consolidação final.

---

## Visão geral

A apuração é a dona dos cadastros (urnas e candidatos): ela exporta um JSON que a urna importa pra rodar a votação. A urna registra e conta os próprios votos e exporta o resultado. A apuração importa esse resultado, valida e declara o vencedor.

Fluxo de ponta a ponta:

1. A urna, ao abrir pela primeira vez, gera e armazena um **código de 6 dígitos**; o operador cadastra esse código na apuração.
2. A apuração gera o cadastro (`candidates.json`), calcula o **hash do JSON original**, **criptografa com o código da urna** e disponibiliza o arquivo criptografado + o hash.
3. A urna faz **upload** do arquivo criptografado, descriptografa com o **mesmo código**, **confere o hash do JSON descriptografado** contra o informado e, se bater, **abre a votação**.
4. Eleitores votam; ao encerrar, a urna monta o boletim (`poll_report`), calcula o **hash do JSON original** e o **criptografa com o código da urna**.
5. A apuração importa os boletins, descriptografa cada um com o **código da urna correspondente**, confere o hash, consolida e **declara o vencedor**.

> Não há assinatura. A troca usa **AES-256-GCM**, com chave derivada por SHA-256 do código de 6 dígitos, e o **hash é do JSON original (antes de criptografar)**. Como o código possui somente 1.000.000 de combinações, este é um esquema de demonstração e não oferece confidencialidade forte.

---

## Provisionamento da urna (código compartilhado + carga criptografada)

Etapa que acontece **antes** da votação, quando a urna é preparada.

1. **Primeira abertura da urna** — o front gera um **código aleatório de 6 dígitos**. O código identifica a urna e funciona como chave compartilhada.
2. **Cadastro no backend** — o código é registrado na apuração, ligando aquela urna ao seu material de votação.
3. **Geração da carga** — a apuração monta o cadastro (`candidates.json`), calcula o **hash do JSON original** e o **criptografa usando o código** daquela urna específica.
4. **Upload na urna** — a urna recebe (upload) o **arquivo criptografado** e o **hash**.
5. **Conferência** — a urna descriptografa com o **código armazenado** e recalcula o hash do JSON obtido, comparando com o informado. Batendo, **abre o processo de votação**; se não bater, recusa a carga.

> O código de 6 dígitos precisa ser tratado como segredo compartilhado entre a urna e a apuração, observada a limitação de segurança descrita acima.

---

## Cadastro de candidatos (a apuração gera, a urna importa)

A apuração é a fonte única do cadastro. Ela exporta o `candidates.json` (criptografado para a urna, conforme acima), e a urna importa pra montar a cédula. O `number` é a chave de 3 dígitos que liga tudo: a urna registra o voto pelo número, o boletim conta por número, e o cadastro dá nome e imagem de cada número.

Contrato (`candidates.json`):

```json
{
  "candidates": [
    {
      "number": "123",
      "name": "Nome do Candidato",
      "party": "Legenda",
      "photo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>...</svg>",
      "name_vice": "Nome do Vice",
      "photo_vice": "<svg>...</svg>"
    }
  ]
}
```

`photo` e `photo_vice` são SVGs, renderizados **inline** pela urna. Cada candidato traz o titular (`name`/`photo`) e o vice (`name_vice`/`photo_vice`).

---

## Serviço 1: Urna de votação (`urna/`)

Autônoma e offline. Gera seu código de 6 dígitos na primeira abertura, importa a carga criptografada com esse código, confere o hash, recebe os votos, faz a própria contagem e, quando é encerrada, emite um boletim (`poll_report`) com o total dela.

Front-end: tela de votação, onde o eleitor escolhe o candidato pelo número e confirma vendo o nome e a imagem (o SVG do cadastro, renderizado inline).

No encerramento, a urna monta o `poll_report`, calcula o **hash do JSON original** e o **criptografa com seu código de 6 dígitos**. Junto do arquivo criptografado vai o hash para conferência.

Conteúdo do boletim (`poll_report`) **antes de criptografar**:

```json
{
  "terminal_id": "terminal-01",
  "type": "poll_report",
  "issued_at": "2026-09-02T20:00:00Z",
  "tally": { "123": 12, "456": 9, "789": 5 },
  "total": 26
}
```

O que trafega é esse JSON **criptografado com o código da urna**, acompanhado do **hash do JSON original (antes de criptografar)**.

---

## Serviço 2: Apuração (`apuracao/`)

Dona dos cadastros. Registra cada urna pelo seu código de 6 dígitos, exporta o `candidates.json` criptografado com esse código e, no fim, importa os `poll_report`. Para cada boletim, descriptografa com o código da urna correspondente e confere o hash antes de consolidar e declarar o vencedor.

Front-end: tela de apuração, onde os votos aparecem sendo contados e no fim aparece o nome e a imagem do vencedor. Vale colocar um delay/suspense na contagem em vez de já cuspir o número de uma vez, fica bem melhor de assistir.

Contrato de saída (`consolidated_report`):

```json
{
  "type": "consolidated_report",
  "issued_at": "2026-09-02T21:10:00Z",
  "tally": { "123": 40, "456": 33, "789": 18 },
  "winner": "123",
  "total": 91
}
```

---

## Princípios

- **Offline**: os dois serviços operam sem depender de rede entre si; a troca é por arquivos (export/import).
- **`number` como chave**: liga cadastro, voto e boletim.
- **Criptografia nos dois sentidos**: `candidates.json` e `poll_report` usam AES-256-GCM com uma chave derivada do código da urna. É um esquema de demonstração, vulnerável a força bruta por causa do espaço de apenas 6 dígitos.
- **Integridade por hash**: o hash é sempre do **JSON original (antes de criptografar)**, garantindo que o conteúdo real é válido. Trafega junto do arquivo e é **exibido nas telas** para conferência visual na hora de importar, nas duas pontas. Não há assinatura.
- **Front-ends separados**: `urna/` e `apuracao/` são independentes.
