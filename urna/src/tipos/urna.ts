export type Candidato = {
  numero: string
  nome: string
  partido: string
  foto: string
  fotoVice?: string
}

export type CandidatoExterno = {
  number: string
  name: string
  party: string
  photo: string
  photo_vice?: string
}

export type ChavesUrnaExternas = {
  publicId: string
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

export type LogicaUrnaExterna = {
  initIfNeeded: () => Promise<ChavesUrnaExternas>
  getCandidates: () => { candidates?: CandidatoExterno[] }
  inputNumber: (number: string) => CandidatoExterno | null
  confirmVote: (number: string) => Record<string, number>
  importEncryptedCandidates: (
    encryptedBase64: string,
    expectedHashHex: string,
  ) => Promise<ResultadoImportacaoExterno>
}

declare global {
  interface Window {
    UrnaFrontendLogic?: LogicaUrnaExterna
  }
}
