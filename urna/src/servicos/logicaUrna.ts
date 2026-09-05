import type {
  Candidato,
  CandidatoExterno,
  EnvelopeBoletimVotacao,
  LogicaUrnaExterna,
  ResultadoExportacaoVotacao,
} from '../tipos/urna'

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

export function obterApuracaoLocal() {
  const contagem = obterLogicaExterna().getTally()

  return {
    contagem,
    total: Object.values(contagem).reduce((soma, votos) => soma + votos, 0),
  }
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

export async function exportarBoletimVotacao(
  identificadorTerminal: string,
): Promise<ResultadoExportacaoVotacao> {
  const terminal = identificadorTerminal.trim()

  if (!terminal) throw new Error('Informe o identificador do terminal.')

  return obterLogicaExterna().exportPollReport(terminal)
}

export function criarArquivoBoletim(resultado: ResultadoExportacaoVotacao) {
  const envelope: EnvelopeBoletimVotacao = {
    encrypted: resultado.encrypted,
    hash: resultado.hash,
  }
  const identificadorSeguro = resultado.report.terminal_id
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\d_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const data = resultado.report.issued_at.slice(0, 10)

  return {
    conteudo: JSON.stringify(envelope, null, 2),
    nome: `boletim-${identificadorSeguro || 'urna'}-${data}.json`,
  }
}

export function obterMensagemErro(erro: unknown, mensagemPadrao: string): string {
  return erro instanceof Error ? erro.message : mensagemPadrao
}
