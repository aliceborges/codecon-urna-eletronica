<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CabecalhoUrna from '../componentes/estrutura/CabecalhoUrna.vue'
import AvisoPrivacidade from '../componentes/estrutura/AvisoPrivacidade.vue'
import DetalhesCandidato from '../componentes/votacao/DetalhesCandidato.vue'
import EntradaNumeroCandidato from '../componentes/votacao/EntradaNumeroCandidato.vue'
import RetratoCandidato from '../componentes/votacao/RetratoCandidato.vue'
import TecladoVotacao from '../componentes/votacao/TecladoVotacao.vue'
import {
  buscarCandidatoPorNumero,
  confirmarVotoBranco,
  confirmarVotoCandidato,
} from '../servicos/logicaUrna'
import { concluirSessaoVotacao } from '../estado/sessaoVotacao'
import type { TipoVoto } from '../estado/sessaoVotacao'

const roteador = useRouter()
const numeroVoto = ref('')
const quantidadeDigitos = 3
const candidatoSelecionado = computed(() => {
  if (numeroVoto.value.length !== quantidadeDigitos) return null

  return buscarCandidatoPorNumero(numeroVoto.value)
})
const candidatoNaoEncontrado = computed(
  () => numeroVoto.value.length === quantidadeDigitos && !candidatoSelecionado.value,
)
const podeConfirmarCandidato = computed(
  () => numeroVoto.value.length === quantidadeDigitos && Boolean(candidatoSelecionado.value),
)

onMounted(() => {
  window.addEventListener('keydown', tratarTecladoFisico)
})

onUnmounted(() => window.removeEventListener('keydown', tratarTecladoFisico))

function inserirDigito(digito: string) {
  if (numeroVoto.value.length >= quantidadeDigitos) return

  numeroVoto.value += digito
}

function limparNumeroVoto() {
  numeroVoto.value = ''
}

function concluirVoto(tipo: TipoVoto) {
  if (tipo === 'candidato' && !podeConfirmarCandidato.value) return

  if (tipo === 'branco') confirmarVotoBranco()
  else confirmarVotoCandidato(numeroVoto.value)

  concluirSessaoVotacao(tipo)
  void roteador.push({ name: 'sucesso' })
}

function tratarTecladoFisico(evento: KeyboardEvent) {
  if (/^\d$/.test(evento.key)) {
    inserirDigito(evento.key)
    return
  }

  if (evento.key === 'Backspace' || evento.key === 'Delete') {
    evento.preventDefault()
    limparNumeroVoto()
  }
}
</script>

<template>
  <main class="estrutura-pagina">
    <section class="urna-eletronica" aria-label="Urna eletrônica">
      <CabecalhoUrna titulo="Urna eletrônica" />

      <div class="corpo-urna">
        <section class="tela-votacao" aria-labelledby="titulo-votacao">
          <div class="topo-tela">
            <span>Seu voto</span>
            <span>Eleição municipal</span>
          </div>

          <div class="conteudo-votacao">
            <div class="dados-voto">
              <p class="rotulo-secao">Candidato</p>
              <h1 id="titulo-votacao">Vote para prefeito</h1>
              <p class="instrucao">Digite o número do candidato no teclado ao lado.</p>

              <EntradaNumeroCandidato :valor="numeroVoto" :quantidade="quantidadeDigitos" />
              <DetalhesCandidato
                :candidato="candidatoSelecionado"
                :nao-encontrado="candidatoNaoEncontrado"
              />
            </div>

            <RetratoCandidato
              :candidato="candidatoSelecionado"
              :nao-encontrado="candidatoNaoEncontrado"
            />
          </div>

          <footer class="rodape-tela">
            <span><b>Branco</b> para votar em branco</span>
            <span><b>Corrige</b> para apagar</span>
            <span><b>Confirma</b> para concluir</span>
          </footer>
        </section>

        <TecladoVotacao
          :pode-confirmar="podeConfirmarCandidato"
          @digito="inserirDigito"
          @branco="concluirVoto('branco')"
          @corrigir="limparNumeroVoto"
          @confirmar="concluirVoto('candidato')"
        />
      </div>
    </section>

    <AvisoPrivacidade texto="Seu voto é secreto e armazenado somente neste terminal." />
  </main>
</template>
