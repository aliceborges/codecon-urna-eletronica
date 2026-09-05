import { ref } from 'vue'

export type TipoVoto = 'candidato' | 'branco'

export const ultimoTipoVoto = ref<TipoVoto>('candidato')
export const votacaoConcluida = ref(false)

export function concluirSessaoVotacao(tipo: TipoVoto) {
  ultimoTipoVoto.value = tipo
  votacaoConcluida.value = true
}

export function reiniciarSessaoVotacao() {
  votacaoConcluida.value = false
  ultimoTipoVoto.value = 'candidato'
}
