import Alpine from 'alpinejs'
import './style.css'
import { fetchCandidates, fetchPollReportPage } from './api.js'

/** Intervalo entre páginas — é o que dá o ritmo de apuração na tela. */
const PAGINA_MS = Number(import.meta.env.VITE_PAGINA_MS) || 400

/** Espera antes de reler uma página que falhou, e teto de tentativas.
 *  A votação já está encerrada e cada página é lida uma vez só: uma leitura
 *  perdida some com aqueles votos de vez, então vale insistir. */
const RETRY_MS = 1500
const MAX_TENTATIVAS = 5

/** Passo da animação dos números. */
const INTERVALO = 60

/** Fração da diferença consumida a cada passo — dá a subida com suspense. */
const SUAVIZACAO = 0.12

/** Cor de cada candidato, na ordem do cadastro. Lima fica por último porque
 *  também é a cor do sistema (progresso, eleito). */
const CORES = ['var(--color-eletrico)', 'var(--color-uva)', 'var(--color-limao)']

Alpine.data('apuracao', () => ({
  candidates: [],

  /** Tally de cada página lida: { [numeroDaPagina]: tally }. */
  paginas: {},
  /** Página sendo lida agora. */
  pagina: 1,
  totalPaginas: 1,
  /** Total geral da apuração, declarado pelo backend em toda página. */
  totalGeral: 0,

  /** Números na tela, correndo atrás do alvo. */
  counted: {},

  status: 'carregando', // carregando | pronto | erro
  erro: '',
  tentativas: 0,
  /** Desistimos de uma página depois de MAX_TENTATIVAS. */
  travado: false,
  /** Vira true ao ler a última página: a apuração acabou. */
  completo: false,

  timerPagina: null,
  timerAnim: null,

  init() {
    this.iniciar()
  },

  destroy() {
    clearTimeout(this.timerPagina)
    clearInterval(this.timerAnim)
  },

  async iniciar() {
    this.status = 'carregando'
    this.erro = ''
    this.paginas = {}
    this.pagina = 1
    this.totalGeral = 0
    this.tentativas = 0
    this.travado = false
    this.completo = false

    try {
      this.candidates = await fetchCandidates()
      this.counted = Object.fromEntries(this.candidates.map((c) => [c.number, 0]))
      this.status = 'pronto'
    } catch (e) {
      this.erro = e.message
      this.status = 'erro'
      return
    }

    clearInterval(this.timerAnim)
    this.timerAnim = setInterval(() => this.passo(), INTERVALO)
    this.ciclo()
  },

  /** Lê a página atual, reflete na tela e segue para a próxima. */
  async ciclo() {
    try {
      const p = await fetchPollReportPage(this.pagina)

      this.paginas[p.page] = p.tally
      this.totalPaginas = p.totalPaginas
      this.totalGeral = p.total
      this.erro = ''
      this.tentativas = 0

      if (this.pagina < this.totalPaginas) {
        this.pagina++
        this.timerPagina = setTimeout(() => this.ciclo(), PAGINA_MS)
      } else {
        // Última página lida. Nada mais entra: a apuração está encerrada.
        this.completo = true
      }
    } catch (e) {
      this.erro = e.message
      this.tentativas++

      if (!this.temDados) {
        this.status = 'erro'
      } else if (this.tentativas < MAX_TENTATIVAS) {
        this.timerPagina = setTimeout(() => this.ciclo(), RETRY_MS * this.tentativas)
      } else {
        // Não dá para seguir sem esta página: o total ficaria errado em
        // silêncio. Para e deixa a decisão na tela.
        this.travado = true
      }
    }
  },

  /** Retoma da página que falhou, sem perder as já lidas. */
  retomar() {
    this.travado = false
    this.tentativas = 0
    this.erro = ''
    this.ciclo()
  },

  get temDados() {
    return Object.keys(this.paginas).length > 0
  },

  /** Soma das páginas lidas até agora — o número real que a tela persegue. */
  get alvo() {
    const soma = Object.fromEntries(this.candidates.map((c) => [c.number, 0]))
    for (const tally of Object.values(this.paginas)) {
      for (const [numero, votos] of Object.entries(tally)) {
        if (numero in soma) soma[numero] += votos
      }
    }
    return soma
  },

  /** Aproxima os números exibidos dos reais, um passo por vez. */
  passo() {
    for (const [numero, alvo] of Object.entries(this.alvo)) {
      const atual = this.counted[numero] ?? 0
      if (atual === alvo) continue
      const diferenca = alvo - atual
      const salto = Math.max(1, Math.ceil(Math.abs(diferenca) * SUAVIZACAO))
      this.counted[numero] = atual + Math.sign(diferenca) * Math.min(salto, Math.abs(diferenca))
    }
    // Acabou de contar e não há mais página: nada a animar daqui pra frente.
    if (this.completo && !this.contando) {
      clearInterval(this.timerAnim)
      this.timerAnim = null
    }
  },

  get apurados() {
    return Object.values(this.counted).reduce((soma, n) => soma + n, 0)
  },

  get alvoTotal() {
    return Object.values(this.alvo).reduce((soma, n) => soma + n, 0)
  },

  /** True enquanto os números na tela ainda estão subindo. */
  get contando() {
    return this.apurados !== this.alvoTotal
  },

  /** True enquanto ainda existem páginas por ler. */
  get lendo() {
    return !this.completo && !this.travado
  },

  /** A apuração terminou e a tela já mostra o número final. */
  get encerrada() {
    return this.completo && !this.contando
  },

  get progresso() {
    const base = this.totalGeral || this.alvoTotal
    return base ? Math.min(100, (this.apurados / base) * 100) : 0
  },

  /** O backend declara o total; a soma das páginas tem que bater com ele.
   *  Se não bater, alguma página veio errada e o resultado não fecha. */
  get divergencia() {
    if (!this.completo || !this.totalGeral) return 0
    return this.alvoTotal - this.totalGeral
  },

  /** Candidatos ordenados pela contagem atual — o ranking se reorganiza sozinho. */
  get ranking() {
    return [...this.candidates].sort((a, b) => this.counted[b.number] - this.counted[a.number])
  },

  get vencedor() {
    const lider = Object.entries(this.alvo).sort(([, a], [, b]) => b - a)[0]
    if (!lider || !lider[1]) return null
    return this.candidates.find((c) => c.number === lider[0])
  },

  /** Cor fixa por candidato — presa ao cadastro, não à posição no ranking. */
  cor(number) {
    const i = this.candidates.findIndex((c) => c.number === number)
    return CORES[i % CORES.length]
  },

  percentual(number) {
    return this.apurados ? ((this.counted[number] ?? 0) / this.apurados) * 100 : 0
  },

  formata(n) {
    return Number(n || 0).toLocaleString('pt-BR')
  },

  /** Texto do indicador de estado. */
  get situacao() {
    if (this.travado) return 'Apuração interrompida'
    if (this.lendo) return `Lendo página ${this.pagina} de ${this.totalPaginas}`
    if (this.contando) return 'Apurando…'
    return 'Apuração encerrada'
  },
}))

Alpine.start()
