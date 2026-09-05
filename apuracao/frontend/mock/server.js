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
 *   GET /candidates.json      -> array de candidatos
 *   GET /poll_report?page=N   -> um poll_report: { tally, total, page, total_pages }
 *
 * Cada página traz só o `tally` daquele pedaço; `total` é o total geral e vem
 * igual em todas. A votação já está encerrada: o conjunto é fixo.
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT) || 3000
const PAGINAS = Math.max(1, Number(process.env.PAGINAS) || 6)
const LATENCIA = Number(process.env.LATENCIA) || 0
const DIVERGIR = Number(process.env.DIVERGIR) || 0

const [alvoFalha, limiteFalhas] = (process.env.FALHAR ?? '').split(':')
const paginaRuim = Number(alvoFalha) || null
const falhasAte = limiteFalhas === undefined ? Infinity : Number(limiteFalhas)
const tentativasNaPaginaRuim = new Map()

/** Espelha os tokens de `src/style.css`, que é a fonte única da paleta. O Node
 *  não lê o CSS, então quando a paleta mudar lá, mude aqui junto. */
const PALETA = {
  noite: '#0e1014',
  limao: '#b1ff37',
  uva: '#8552e9',
  eletrico: '#273aff',
}

/** Retrato geométrico — o contrato pede SVG renderizado inline pela tela.
 *  Os fundos seguem a ordem de cores que a tela usa nas barras. */
const retrato = (fundo, tom) => `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="${fundo}"/>
  <circle cx="100" cy="76" r="34" fill="${tom}"/>
  <path d="M34 200c0-36 30-58 66-58s66 22 66 58z" fill="${tom}"/>
</svg>`

const CANDIDATOS = [
  { number: '10', name: 'Ana Ribeiro', party: 'Partido Aurora', photo: retrato(PALETA.eletrico, PALETA.noite) },
  { number: '20', name: 'Bruno Tavares', party: 'Partido Horizonte', photo: retrato(PALETA.uva, PALETA.noite) },
  { number: '30', name: 'Célia Moraes', party: 'Partido Raiz', photo: retrato(PALETA.limao, PALETA.noite) },
]

/** Resultado final e como ele se espalha pelas páginas. Os pesos fazem o
 *  Bruno liderar no começo e a Ana virar no fim — a tela reordena ao vivo. */
const RESULTADO = {
  10: { votos: 239, pesos: [1, 1, 2, 3, 3, 4] },
  20: { votos: 214, pesos: [4, 3, 2, 1, 1, 1] },
  30: { votos: 108, pesos: [1, 1, 1, 1, 1, 1] },
}

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

const tallyDaPagina = (page) =>
  Object.fromEntries(Object.entries(PORPAGINA).map(([numero, partes]) => [numero, partes[page - 1]]))

const SOMA_REAL = Object.values(RESULTADO).reduce((s, r) => s + r.votos, 0)
const TOTAL_DECLARADO = SOMA_REAL + DIVERGIR

const json = (res, status, corpo) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(corpo))
}

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (LATENCIA) await new Promise((r) => setTimeout(r, LATENCIA))

  if (url.pathname === '/candidates.json') {
    console.log('GET /candidates.json')
    return json(res, 200, CANDIDATOS)
  }

  if (url.pathname === '/poll_report') {
    const page = Math.min(PAGINAS, Math.max(1, Number(url.searchParams.get('page')) || 1))

    if (page === paginaRuim) {
      const tentativa = (tentativasNaPaginaRuim.get(page) ?? 0) + 1
      tentativasNaPaginaRuim.set(page, tentativa)
      if (tentativa <= falhasAte) {
        console.log(`GET /poll_report?page=${page} -> 503 (tentativa ${tentativa})`)
        return res.writeHead(503).end()
      }
    }

    const tally = tallyDaPagina(page)
    console.log(`GET /poll_report?page=${page} de ${PAGINAS} -> ${JSON.stringify(tally)}`)
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
