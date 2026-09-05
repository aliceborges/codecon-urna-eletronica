// Importa o mesmo CSS da apuração: a paleta exibida aqui é a paleta real.
import '../src/style.css'
import { CORES_PARTIDO, corDoCard, corDoChip } from '../src/partidos.js'

/** Papel de cada token. Os valores não são repetidos — vêm do CSS em runtime. */
const TOKENS = [
  { nome: 'noite', papel: 'Fundo da página, trilho das barras e texto sobre os botões lima.' },
  { nome: 'carvao', papel: 'Superfície: cards de candidato e trilho da barra de progresso.' },
  { nome: 'gelo', papel: 'Todo o texto. Cheio nos números, esmaecido na informação secundária.' },
  { nome: 'limao', papel: 'Cor do sistema: botões, progresso, indicador ao vivo e o card do eleito.' },
  { nome: 'uva', papel: 'Avisos e erros: cards de falha e o ponto quando a apuração trava.' },
  { nome: 'eletrico', papel: 'Partido azul (301). Também usada como acento.' },
  { nome: 'verde', papel: 'Partido verde (408).' },
  { nome: 'amarelo', papel: 'Partido amarelo (418).' },
  { nome: 'vermelho', papel: 'Partido vermelho (500).' },
]

/** Variações de opacidade que a tela realmente usa. */
const VARIACOES = [
  { nome: 'gelo', graus: [100, 70, 50, 40] },
  { nome: 'limao', graus: [100, 40, 10] },
  { nome: 'uva', graus: [100, 40, 10] },
]

/** Mapa de partidos, lido de src/partidos.js — a mesma fonte que a apuração usa. */
const PARTIDOS = Object.entries(CORES_PARTIDO)

const valor = (nome) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-${nome}`).trim()

const app = document.getElementById('app')

app.innerHTML = `
  <header class="mb-10">
    <h1 class="text-3xl font-semibold tracking-tight">Paleta</h1>
    <p class="mt-1 text-sm text-gelo/50">
      Definida em <code class="text-gelo/70">src/style.css</code>. Os valores abaixo são lidos do
      CSS em tempo de execução, então esta página nunca fica fora de sincronia.
    </p>
  </header>

  <section class="grid gap-4 sm:grid-cols-2">
    ${TOKENS.map(
      ({ nome, papel }) => `
      <article class="rounded-xl bg-carvao p-4">
        <!-- A borda é o que torna noite e carvao visíveis: sem ela, some
             contra o fundo da página e contra o próprio card. -->
        <div class="h-24 rounded-lg border border-gelo/25" style="background: ${valor(nome)}"></div>
        <div class="pt-4">
          <div class="flex items-baseline justify-between gap-3">
            <span class="font-medium">${nome}</span>
            <code class="text-xs uppercase text-gelo/50">${valor(nome)}</code>
          </div>
          <p class="mt-2 text-xs leading-relaxed text-gelo/50">${papel}</p>
          <code class="mt-3 block text-xs text-gelo/40">--color-${nome}</code>
        </div>
      </article>`,
    ).join('')}
  </section>

  <section class="mt-12">
    <h2 class="text-sm font-medium">Opacidades em uso</h2>
    <div class="mt-4 flex flex-col gap-3">
      ${VARIACOES.map(
        ({ nome, graus }) => `
        <div class="flex items-center gap-3">
          <span class="w-16 shrink-0 text-xs text-gelo/50">${nome}</span>
          ${graus
            .map(
              (g) => `
            <div class="flex-1">
              <div
                class="h-10 rounded-md border border-gelo/15"
                style="background: ${valor(nome)}; opacity: ${g / 100}"
              ></div>
              <span class="mt-1 block text-center text-[10px] text-gelo/40">${g === 100 ? '—' : `/${g}`}</span>
            </div>`,
            )
            .join('')}
        </div>`,
      ).join('')}
    </div>
  </section>

  <section class="mt-12">
    <h2 class="text-sm font-medium">Cor por partido</h2>
    <p class="mt-1 text-xs text-gelo/50">
      Fixada pelo número do candidato. O card usa a cor cheia; o chip da sigla
      usa a mesma cor puxada para o escuro.
    </p>
    <div class="mt-4 flex flex-wrap gap-3">
      ${PARTIDOS.map(
        ([numero, { rotulo, base, texto }]) => `
        <div class="w-40 rounded-xl p-3" style="background: ${corDoCard(base)}; color: ${texto}">
          <div class="flex items-center gap-2">
            <span
              class="rounded-md px-2 py-0.5 text-[11px] font-semibold text-gelo"
              style="background: ${corDoChip(base)}"
            >chip</span>
            <span class="font-mono text-lg font-semibold">${numero}</span>
          </div>
          <p class="mt-2 text-xs opacity-70">${rotulo}</p>
        </div>`,
      ).join('')}
    </div>
  </section>
`
