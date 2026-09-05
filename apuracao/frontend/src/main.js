import Alpine from 'alpinejs'
import './style.css'
import { fetchCandidates, fetchPollReportPage } from './api.js'

/** Intervalo entre páginas — é o que dá o ritmo de apuração na tela. */
const PAGINA_MS = Number(import.meta.env.VITE_PAGINA_MS) || 3000

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

  /** Votos já lidos, somados página a página. As páginas chegam uma vez só e
   *  em ordem fixa, então dá para acumular direto em vez de guardar cada uma. */
  alvo: {},
  alvoTotal: 0,
  paginasLidas: 0,

  /** Página sendo lida agora. */
  pagina: 1,
  totalPaginas: 1,
  /** Total geral da apuração, declarado pelo backend em toda página. */
  totalGeral: 0,

  /** Números na tela, correndo atrás do alvo. */
  counted: {},

  status: 'ocioso', // ocioso | carregando | pronto | erro
  erro: '',
  tentativas: 0,
  /** Vira true ao ler a última página: a apuração acabou. */
  completo: false,

  timerPagina: null,
  timerAnim: null,

  destroy() {
    clearTimeout(this.timerPagina)
    clearInterval(this.timerAnim)
  },

  async iniciar() {
    this.status = 'carregando'
    this.erro = ''
    this.pagina = 1
    this.totalPaginas = 1
    this.totalGeral = 0
    this.alvoTotal = 0
    this.paginasLidas = 0
    this.tentativas = 0
    this.completo = false

    try {
      const cadastro = await fetchCandidates()
      // A cor acompanha o candidato desde o cadastro, então não muda quando o
      // ranking se reorganiza.
      this.candidates = cadastro.map((c, i) => ({ ...c, cor: CORES[i % CORES.length] }))
      this.counted = Object.fromEntries(this.candidates.map((c) => [c.number, 0]))
      this.alvo = Object.fromEntries(this.candidates.map((c) => [c.number, 0]))
      this.status = 'pronto'
    } catch (e) {
      this.erro = e.message
      this.status = 'erro'
      return
    }

    this.animar()
    this.ciclo()
  },

  /** Liga a animação dos números, se ainda não estiver rodando. */
  animar() {
    if (!this.timerAnim) this.timerAnim = setInterval(() => this.passo(), INTERVALO)
  },

  /** Lê a página atual, reflete na tela e segue para a próxima. */
  async ciclo() {
    try {
      const p = await fetchPollReportPage(this.pagina)

      for (const [numero, votos] of Object.entries(p.tally)) {
        if (numero in this.alvo) {
          this.alvo[numero] += votos
          this.alvoTotal += votos
        }
      }
      this.paginasLidas++
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
      } else if (!this.travado) {
        this.timerPagina = setTimeout(() => this.ciclo(), RETRY_MS * this.tentativas)
      }
      // Esgotadas as tentativas, `travado` para tudo: seguir sem esta página
      // deixaria o total errado em silêncio.
    }
  },

  /** Retoma da página que falhou, sem perder as já lidas. */
  retomar() {
    this.tentativas = 0
    this.erro = ''
    this.animar()
    this.ciclo()
  },

  get temDados() {
    return this.paginasLidas > 0
  },

  /** Desistimos da página depois de MAX_TENTATIVAS. */
  get travado() {
    return this.tentativas >= MAX_TENTATIVAS
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
    // Nada mais a animar: nem página por vir, nem número por alcançar.
    if (!this.contando && (this.completo || this.travado)) {
      clearInterval(this.timerAnim)
      this.timerAnim = null
    }
  },

  get apurados() {
    return Object.values(this.counted).reduce((soma, n) => soma + n, 0)
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
    return this.completo && this.totalGeral > 0 && this.alvoTotal !== this.totalGeral
  },

  /** Candidatos ordenados pela contagem atual — o ranking se reorganiza sozinho. */
  get ranking() {
    return [...this.candidates].sort((a, b) => this.counted[b.number] - this.counted[a.number])
  },

  get vencedor() {
    const lider = this.ranking[0]
    return lider && this.counted[lider.number] > 0 ? lider : null
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
    if (this.lendo) return `Apuração em progresso ${this.progresso.toFixed(2)}%.`
    if (this.contando) return 'Apurando…'
    return 'Apuração encerrada'
  },
}))

Alpine.start()
