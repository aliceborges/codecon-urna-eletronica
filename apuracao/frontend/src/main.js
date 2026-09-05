import Alpine from 'alpinejs'
import './style.css'
import { fetchCandidates, fetchPollReportPage } from './api.js'
import { coresDoCandidato } from './partidos.js'

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

/** Palavras que não entram na sigla derivada de um partido sem sigla própria. */
const ATONAS = new Set(['do', 'da', 'de', 'dos', 'das', 'e', 'na', 'no'])

/**
 * Separa "PLN - Partido do Legado Nacional" em sigla e nome.
 * Quando o dado não traz sigla, deriva das iniciais das palavras com peso.
 */
function separarPartido(party) {
  const texto = String(party ?? '').trim()
  const [inicio, ...resto] = texto.split(/\s+-\s+/)
  if (resto.length) return { sigla: inicio, partidoNome: resto.join(' - ') }

  const sigla = texto
    .split(/\s+/)
    .filter((palavra) => palavra && !ATONAS.has(palavra.toLowerCase()))
    .map((palavra) => palavra[0])
    .join('')
    .toUpperCase()
  return { sigla, partidoNome: texto }
}

/** Quantos candidatos ficam no pódio, empilhados. O resto vai para a fileira. */
const PODIO = 3

/** Geometria do pódio. A altura do card sai daqui e é aplicada no style, então
 *  o cálculo e o HTML não têm como divergir. O 2º e o 3º usam `scale`: assim
 *  tamanho e posição animam na mesma transição de transform. */
const ALTURA_PODIO = 212
const ESCALA_PODIO = 0.82
const GAP = 8

/** Passo horizontal da fileira: largura do card (w-42) + gap. */
const PASSO_FILEIRA = 176

/** Sorteia um número no intervalo, para variar as trajetórias do fundo. */
const sorteio = (min, max) => min + Math.random() * (max - min)

/** Camada decorativa: textos e emojis cruzando a tela. Os valores são
 *  sorteados uma vez na montagem; daí em diante é só CSS. */
Alpine.data('fundo', () => ({
  itens: [],

  init() {
    const conteudos = ['eleições codecon', 'in code we trust', '🐥', '🐼']

    this.itens = Array.from({ length: 100 }, (_, i) => {
      const texto = conteudos[i % conteudos.length]
      const ehEmoji = !texto.includes(' ')
      const inverso = i % 3 === 0
      const umAngulo = sorteio(-30, 30).toFixed(1)

      return {
        texto,
        inverso,
        estilo: [
          `top: ${sorteio(-10, 100).toFixed(1)}%`,
          `font-size: ${(ehEmoji ? sorteio(28, 72) : sorteio(13, 30)).toFixed(0)}px`,
          `opacity: ${sorteio(0.02, 0.06).toFixed(3)}`,
          `--giro: ${umAngulo}deg`,
          // Bem devagar, e com atraso negativo para já começarem espalhados.
          `animation-duration: ${sorteio(45, 110).toFixed(0)}s`,
          `animation-delay: -${sorteio(0, 110).toFixed(0)}s`,
        ].join('; '),
      }
    })
  },
}))

Alpine.data('apuracao', () => ({
  candidates: [],

  /** Votos já lidos, somados página a página. As páginas chegam uma vez só e
   *  em ordem fixa, então dá para acumular direto em vez de guardar cada uma. */
  alvo: {},
  /** Votos do tally que não são de candidato (branco, nulo). Não entram no
   *  ranking, mas o `total` do backend os conta — então entram na soma. */
  alvoOutros: 0,
  alvoTotal: 0,

  /** Página sendo lida agora. */
  pagina: 1,
  totalPaginas: 1,
  /** Total geral da apuração, declarado pelo backend em toda página. */
  totalGeral: 0,

  /** Números na tela, correndo atrás do alvo. */
  counted: {},
  contadoOutros: 0,

  status: 'ocioso', // ocioso | carregando | cadastrado | apurando | erro
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

  /** Etapa 1: busca o cadastro e mostra os candidatos zerados. */
  async carregarCadastro() {
    this.status = 'carregando'
    this.erro = ''

    try {
      const cadastro = await fetchCandidates()
      // A cor acompanha o candidato desde o cadastro, então não muda quando o
      // ranking se reorganiza.
      this.candidates = cadastro.map((c) => ({
        ...c,
        ...coresDoCandidato(c.number),
        ...separarPartido(c.party),
      }))
      this.zerar()
      this.status = 'cadastrado'
    } catch (e) {
      this.erro = e.message
      this.status = 'erro'
    }
  },

  /** Etapa 2: começa a ler as páginas e a contar. */
  iniciar() {
    this.zerar()
    this.status = 'apurando'
    this.animar()
    this.ciclo()
  },

  /** Volta a apuração ao ponto de partida, mantendo o cadastro. */
  zerar() {
    clearTimeout(this.timerPagina)
    this.pagina = 1
    this.totalPaginas = 1
    this.totalGeral = 0
    this.alvoOutros = 0
    this.alvoTotal = 0
    this.contadoOutros = 0
    this.tentativas = 0
    this.completo = false
    this.erro = ''
    this.counted = Object.fromEntries(this.candidates.map((c) => [c.number, 0]))
    this.alvo = Object.fromEntries(this.candidates.map((c) => [c.number, 0]))
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
        if (numero in this.alvo) this.alvo[numero] += votos
        else this.alvoOutros += votos
        this.alvoTotal += votos
      }
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

      if (!this.travado) {
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

  /** Cadastro na tela: seja aguardando o início, seja apurando. */
  get temCadastro() {
    return this.status === 'cadastrado' || this.status === 'apurando'
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
    if (this.contadoOutros !== this.alvoOutros) {
      const diferenca = this.alvoOutros - this.contadoOutros
      const salto = Math.max(1, Math.ceil(Math.abs(diferenca) * SUAVIZACAO))
      this.contadoOutros += Math.sign(diferenca) * Math.min(salto, Math.abs(diferenca))
    }
    // Nada mais a animar: nem página por vir, nem número por alcançar.
    if (!this.contando && (this.completo || this.travado)) {
      clearInterval(this.timerAnim)
      this.timerAnim = null
    }
  },

  /** Tudo que já está na tela, brancos e nulos incluídos — é com isto que o
   *  total do backend tem que fechar. */
  get apurados() {
    return Object.values(this.counted).reduce((soma, n) => soma + n, 0) + this.contadoOutros
  },

  /** True enquanto os números na tela ainda estão subindo. */
  get contando() {
    return this.apurados !== this.alvoTotal
  },

  /** True enquanto ainda existem páginas por ler. */
  get lendo() {
    return this.status === 'apurando' && !this.completo && !this.travado
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

  /**
   * Posição de cada candidato, por número.
   *
   * Os cards são renderizados na ordem fixa do cadastro e deslocados por
   * `transform`. Como o DOM nunca se reordena, o navegador anima a troca de
   * posição sozinho — não é preciso mexer em nó nenhum.
   */
  get posicoes() {
    const mapa = {}
    this.ranking.forEach((c, i) => (mapa[c.number] = i))
    return mapa
  },

  posicao(number) {
    return this.posicoes[number] ?? 0
  },

  noPodio(number) {
    return this.posicao(number) < PODIO
  },

  /** Altura do card do 1º lugar; os menores saem dela pela escala. */
  get alturaCardPodio() {
    return ALTURA_PODIO
  },

  /** Deslocamento e escala de um card do pódio. O 1º fica inteiro no topo; os
   *  seguintes empilham já reduzidos, então a conta usa a altura escalada. */
  deslocamentoPodio(number) {
    const posicao = this.posicao(number)
    const menor = ALTURA_PODIO * ESCALA_PODIO
    const y = posicao === 0 ? 0 : ALTURA_PODIO + GAP + (posicao - 1) * (menor + GAP)
    return `translateY(${y}px) scale(${posicao === 0 ? 1 : ESCALA_PODIO})`
  },

  /** Deslocamento horizontal de um card da fileira. */
  deslocamentoFileira(number) {
    return `translateX(${Math.max(0, this.posicao(number) - PODIO) * PASSO_FILEIRA}px)`
  },

  /** Alturas e larguras dos contêineres absolutos, em px. */
  get alturaPodio() {
    const quantos = Math.min(PODIO, this.candidates.length)
    if (!quantos) return 0
    return ALTURA_PODIO + (quantos - 1) * (ALTURA_PODIO * ESCALA_PODIO + GAP)
  },

  get larguraFileira() {
    const quantos = Math.max(0, this.candidates.length - PODIO)
    return quantos ? quantos * PASSO_FILEIRA - GAP : 0
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
