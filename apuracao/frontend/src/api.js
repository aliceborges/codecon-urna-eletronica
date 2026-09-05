/** Backend da apuração. Sobrescreva com VITE_API_URL no .env. */
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/** Usada quando o cadastro vem sem `photo`. Fotos reais são SVG inline. */
const SILHUETA = `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="78" r="38" fill="var(--color-noite)"/>
    <path d="M30 200c0-38 31-62 70-62s70 24 70 62z" fill="var(--color-noite)"/>
  </svg>`

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`O backend respondeu ${res.status}`)
  return res.json()
}

/**
 * Busca o cadastro de candidatos.
 *
 * O backend devolve a lista pura; o envelope `{ candidates: [...] }` do formato
 * de arquivo do README também é aceito.
 */
export async function fetchCandidates() {
  const body = await getJSON(`${BASE}/apuracao/candidates`)
  const lista = Array.isArray(body) ? body : body?.candidates
  if (!Array.isArray(lista)) throw new Error('Resposta sem a lista de candidatos')

  return lista.map((c) => ({
    ...c,
    number: String(c.number),
    photo: c.photo || SILHUETA,
    // Só há foto de vice quando há vice; sem foto, cai na silhueta.
    photo_vice: c.name_vice ? c.photo_vice || SILHUETA : null,
  }))
}

/**
 * Lê UMA página da apuração. A tela chama isto em sequência e se atualiza a
 * cada resposta, em vez de esperar tudo terminar.
 *
 * Cada página é um `poll_report` único (não uma lista): de página para página
 * mudam só o `tally` — o pedaço dos votos daquela página — e o número da
 * página. `total` é o total geral da apuração e vem igual em todas.
 *
 * O `tally` traz chaves que não são candidatos (`blank`), e o `total` as conta:
 * quem soma precisa incluí-las para fechar com o total declarado.
 *
 * A votação já está encerrada e a ordem das páginas não muda: o conjunto é
 * fixo do começo ao fim, cada página é lida uma vez, e a última encerra.
 */
export async function fetchPollReportPage(page) {
  const body = await getJSON(`${BASE}/apuracao/resultados?page=${page}`)
  if (!body?.tally || typeof body.tally !== 'object') {
    throw new Error('Resposta sem o tally da página')
  }

  const tally = {}
  for (const [numero, votos] of Object.entries(body.tally)) {
    tally[String(numero)] = Number(votos) || 0
  }

  return {
    totalPaginas: Math.max(1, Number(body.total_pages) || 1),
    /** Total geral da apuração — o mesmo em todas as páginas. */
    total: Number(body.total) || 0,
    tally,
  }
}
