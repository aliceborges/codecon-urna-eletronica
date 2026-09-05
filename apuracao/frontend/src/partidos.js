/**
 * Cor de cada partido, fixada pelo número do candidato.
 *
 * `base` é a cor viva; o card e o chip saem dela puxados para o escuro do tema.
 * Os dois números abaixo controlam o tom de tudo de uma vez.
 */
const COR_CARD = 62
const COR_CHIP = 38

/** Mistura a cor com o fundo escuro. `quanto` é o percentual da cor viva. */
const misturar = (cor, quanto) => `color-mix(in oklab, ${cor} ${quanto}%, var(--color-noite))`

export const corDoCard = (base) => misturar(base, COR_CARD)
export const corDoChip = (base) => misturar(base, COR_CHIP)

export const CORES_PARTIDO = {
  301: { rotulo: 'Azul', base: 'var(--color-eletrico)', texto: 'var(--color-gelo)' },
  403: { rotulo: 'Roxo', base: 'var(--color-uva)', texto: 'var(--color-gelo)' },
  408: { rotulo: 'Verde', base: 'var(--color-verde)', texto: 'var(--color-gelo)' },
    // Amarelo é claro demais mesmo escurecido: só ele leva texto escuro.
  418: { rotulo: 'Amarelo', base: 'var(--color-amarelo)', texto: 'var(--color-noite)' },
  500: { rotulo: 'Vermelho', base: 'var(--color-vermelho)', texto: 'var(--color-gelo)' },
}

/** Usada quando aparece um número fora do mapa acima. */
const PADRAO = { base: 'var(--color-carvao)', texto: 'var(--color-gelo)' }

export function coresDoCandidato(number) {
  const { base, texto } = CORES_PARTIDO[number] ?? PADRAO
  return { cor: corDoCard(base), corTexto: texto, corChip: corDoChip(base) }
}
