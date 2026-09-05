export type Candidato = {
  numero: string
  nome: string
  partido: string
  foto: string
  nomeVice?: string
  fotoVice?: string
}

export type CandidatoExterno = {
  number: string
  name: string
  party: string
  photo: string
  name_vice?: string
  photo_vice?: string
}

export type CodigoUrnaExterno = {
  code: string
}

export type ResultadoImportacaoExterno = {
  ok: boolean
  computed: string
  obj: {
    candidates?: CandidatoExterno[]
  }
}

export type EnvelopeArquivoCandidatos = {
  encrypted?: string
  hash?: string
}

export type RelatorioVotacao = {
  terminal_id: string
  type: 'poll_report'
  issued_at: string
  tally: Record<string, number>
  total: number
}

export type ResultadoExportacaoVotacao = {
  encrypted: string
  hash: string
  report: RelatorioVotacao
}

export type EnvelopeBoletimVotacao = Pick<ResultadoExportacaoVotacao, 'encrypted' | 'hash'>

export type LogicaUrnaExterna = {
  initIfNeeded: () => Promise<CodigoUrnaExterno>
  getCandidates: () => { candidates?: CandidatoExterno[] }
  getTally: () => Record<string, number>
  inputNumber: (number: string) => CandidatoExterno | null
  confirmVote: (number: string) => Record<string, number>
  importEncryptedCandidates: (
    encryptedBase64: string,
    expectedHashHex: string,
  ) => Promise<ResultadoImportacaoExterno>
  exportPollReport: (terminalId: string) => Promise<ResultadoExportacaoVotacao>
}

declare global {
  interface Window {
    UrnaFrontendLogic?: LogicaUrnaExterna
  }
}
