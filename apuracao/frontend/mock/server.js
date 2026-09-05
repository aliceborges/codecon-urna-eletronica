#!/usr/bin/env node
/**
 * Backend falso da apuração — para desenvolver e testar a tela sem depender
 * do backend real. Sem dependências: só Node.
 *
 *   npm run mock
 *
 * Variáveis de ambiente:
 *   PORT=3000       porta
 *   PAGINAS=6       em quantas páginas a apuração é servida
 *   LATENCIA=0      ms de atraso artificial por resposta
 *   FALHAR=         injeta falha numa página, para testar o retry:
 *                     "3"    -> a página 3 falha sempre (leva a tela a travar)
 *                     "3:2"  -> falha nas 2 primeiras tentativas e depois passa
 *   DIVERGIR=0      soma esse tanto ao `total` declarado sem existir em página
 *                   alguma, para testar o aviso de soma que não fecha
 *
 * Rotas:
 *   GET /apuracao/candidates  -> o conteúdo de mock/candidatos.json, como está
 *   GET /apuracao/resultados?page=N -> um poll_report: { tally, total, page, total_pages }
 *
 * O cadastro vem do arquivo, então basta editar mock/candidatos.json para mudar
 * quem concorre; os votos se ajustam sozinhos aos números que estiverem lá.
 *
 * Cada página traz só o `tally` daquele pedaço; `total` é o total geral e vem
 * igual em todas. A votação já está encerrada: o conjunto é fixo.
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

const PORT = Number(process.env.PORT) || 3000
const PAGINAS = Math.max(1, Number(process.env.PAGINAS) || 6)
const LATENCIA = Number(process.env.LATENCIA) || 0
const DIVERGIR = Number(process.env.DIVERGIR) || 0

const [alvoFalha, limiteFalhas] = (process.env.FALHAR ?? '').split(':')
const paginaRuim = Number(alvoFalha) || null
const falhasAte = limiteFalhas === undefined ? Infinity : Number(limiteFalhas)
const tentativasNaPaginaRuim = new Map()

/** O cadastro é o arquivo, servido como está — inclusive o envelope e o hash. */
const ARQUIVO_CADASTRO = new URL('./candidatos.json', import.meta.url)
let TEXTO_CADASTRO
let CADASTRO
try {
  // Guardamos o texto cru para devolver o arquivo idêntico, hash incluído.
  TEXTO_CADASTRO = readFileSync(ARQUIVO_CADASTRO, 'utf8')
  CADASTRO = JSON.parse(TEXTO_CADASTRO)
} catch (e) {
  console.error(`\nNão consegui ler mock/candidatos.json: ${e.message}\n`)
  process.exit(1)
}

const CANDIDATOS = Array.isArray(CADASTRO) ? CADASTRO : (CADASTRO.candidates ?? [])
if (!CANDIDATOS.length) {
  console.error('\nmock/candidatos.json não tem nenhum candidato.\n')
  process.exit(1)
}

/** Perfis de votação aplicados na ordem do cadastro, quantos candidatos houver.
 *  Os pesos espalham os votos pelas páginas: o primeiro perfil é puxado para o
 *  fim e o segundo para o começo, então a liderança vira durante a contagem. */
const PERFIS = [
  { votos: 239, pesos: [1, 1, 2, 3, 3, 4] },
  { votos: 214, pesos: [4, 3, 2, 1, 1, 1] },
  { votos: 108, pesos: [1, 1, 1, 1, 1, 1] },
  { votos: 61, pesos: [2, 1, 2, 1, 2, 1] },
]

const RESULTADO = Object.fromEntries(
  CANDIDATOS.map((c, i) => [String(c.number), PERFIS[i % PERFIS.length]]),
)

/** Divide `total` em `paginas` partes inteiras que somam exatamente `total`. */
function distribuir(total, pesos, paginas) {
  const usados = Array.from({ length: paginas }, (_, i) => pesos[i % pesos.length])
  const somaPesos = usados.reduce((s, p) => s + p, 0)
  const partes = usados.map((p) => Math.floor((total * p) / somaPesos))
  // Sobra da divisão inteira vai para as páginas de maior peso.
  let resto = total - partes.reduce((s, n) => s + n, 0)
  const ordem = usados.map((p, i) => [p, i]).sort(([a], [b]) => b - a)
  for (let i = 0; resto > 0; i = (i + 1) % ordem.length, resto--) partes[ordem[i][1]]++
  return partes
}

const PORPAGINA = Object.fromEntries(
  Object.entries(RESULTADO).map(([numero, { votos, pesos }]) => [
    numero,
    distribuir(votos, pesos, PAGINAS),
  ]),
)

/** O backend real inclui `blank` no tally e o conta no `total`. */
const BRANCOS = Array.from({ length: PAGINAS }, (_, i) => (i % 3 === 0 ? 1 : 0))

const tallyDaPagina = (page) => ({
  ...Object.fromEntries(Object.entries(PORPAGINA).map(([n, partes]) => [n, partes[page - 1]])),
  blank: BRANCOS[page - 1],
})

const SOMA_REAL =
  Object.values(RESULTADO).reduce((s, r) => s + r.votos, 0) + BRANCOS.reduce((s, n) => s + n, 0)
const TOTAL_DECLARADO = SOMA_REAL + DIVERGIR

const json = (res, status, corpo) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(corpo))
}

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (LATENCIA) await new Promise((r) => setTimeout(r, LATENCIA))

  if (url.pathname === '/apuracao/candidates-prod') {
    console.log(`GET /apuracao/candidates-prod -> ${CANDIDATOS.length} candidatos`)
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    return res.end(TEXTO_CADASTRO)
  }

  if (url.pathname === '/apuracao/resultados-prod') {
    const page = Math.min(PAGINAS, Math.max(1, Number(url.searchParams.get('page')) || 1))

    if (page === paginaRuim) {
      const tentativa = (tentativasNaPaginaRuim.get(page) ?? 0) + 1
      tentativasNaPaginaRuim.set(page, tentativa)
      if (tentativa <= falhasAte) {
        console.log(`GET /apuracao/resultados-prod?page=${page} -> 503 (tentativa ${tentativa})`)
        return res.writeHead(503).end()
      }
    }

    const tally = tallyDaPagina(page)
    console.log(`GET /apuracao/resultados-prod?page=${page} de ${PAGINAS} -> ${JSON.stringify(tally)}`)
    return json(res, 200, {
      type: 'poll_report',
      issued_at: new Date(Date.UTC(2026, 8, 5, 21, 0, 0)).toISOString(),
      tally,
      total: TOTAL_DECLARADO,
      page,
      total_pages: PAGINAS,
    })
  }

  res.writeHead(404).end()
}).listen(PORT, () => {
  console.log(`\nMock da apuração em http://localhost:${PORT}`)
  console.log(`  cadastro: mock/candidatos.json · ${CANDIDATOS.length} candidatos`)
  console.log(`  ${PAGINAS} páginas · total declarado ${TOTAL_DECLARADO}`)
  if (LATENCIA) console.log(`  latência: ${LATENCIA}ms`)
  if (paginaRuim) {
    const quantas = falhasAte === Infinity ? 'sempre' : `nas ${falhasAte} primeiras tentativas`
    console.log(`  página ${paginaRuim} falha ${quantas}`)
  }
  if (DIVERGIR) console.log(`  total declarado ${DIVERGIR} acima da soma real (${SOMA_REAL})`)

  const esperado = Object.fromEntries(Object.entries(RESULTADO).map(([n, r]) => [n, r.votos]))
  console.log(`\n  resultado esperado: ${JSON.stringify(esperado)} — ${SOMA_REAL} votos`)
  const [numero, { votos }] = Object.entries(RESULTADO).sort(([, a], [, b]) => b.votos - a.votos)[0]
  console.log(`  eleito esperado:    ${numero} ${CANDIDATOS.find((c) => c.number === numero)?.name} com ${votos} votos\n`)
})
