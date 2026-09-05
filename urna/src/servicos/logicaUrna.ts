import type { Candidato, CandidatoExterno, LogicaUrnaExterna } from '../tipos/urna'

function obterLogicaExterna(): LogicaUrnaExterna {
  if (!window.UrnaFrontendLogic) {
    throw new Error('A lógica de provisionamento da urna não foi carregada.')
  }

  return window.UrnaFrontendLogic
}

function converterCandidato(candidato: CandidatoExterno): Candidato {
  return {
    numero: String(candidato.number),
    nome: candidato.name,
    partido: candidato.party,
    foto: candidato.photo,
    nomeVice: candidato.name_vice,
    fotoVice: candidato.photo_vice,
  }
}

export async function inicializarUrna() {
  const urna = await obterLogicaExterna().initIfNeeded()
  return { codigo: urna.code }
}

export function obterCandidatos(): Candidato[] {
  return (obterLogicaExterna().getCandidates().candidates ?? []).map(converterCandidato)
}

export function buscarCandidatoPorNumero(numero: string): Candidato | null {
  const candidato = obterLogicaExterna().inputNumber(numero)
  return candidato ? converterCandidato(candidato) : null
}

export function confirmarVotoCandidato(numero: string) {
  return obterLogicaExterna().confirmVote(numero)
}

export function confirmarVotoBranco() {
  return obterLogicaExterna().confirmVote('blank')
}

export async function importarCandidatosCriptografados(carga: string, hashEsperado: string) {
  const resultado = await obterLogicaExterna().importEncryptedCandidates(carga, hashEsperado)
  return {
    valido: resultado.ok,
    hashCalculado: resultado.computed,
    candidatos: (resultado.obj.candidates ?? []).map(converterCandidato),
  }
}

export function urnaEstaConfigurada() {
  try {
    return obterCandidatos().length > 0
  } catch {
    return false
  }
}

export function obterMensagemErro(erro: unknown, mensagemPadrao: string): string {
  return erro instanceof Error ? erro.message : mensagemPadrao
}
