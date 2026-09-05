<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CabecalhoUrna from '../componentes/estrutura/CabecalhoUrna.vue'
import AvisoPrivacidade from '../componentes/estrutura/AvisoPrivacidade.vue'
import CartaoArquivoCandidatos from '../componentes/configuracao/CartaoArquivoCandidatos.vue'
import RodapeStatusConfiguracao from '../componentes/configuracao/RodapeStatusConfiguracao.vue'
import CartaoCodigoUrna from '../componentes/configuracao/CartaoCodigoUrna.vue'
import {
  importarCandidatosCriptografados,
  inicializarUrna,
  obterCandidatos,
  obterMensagemErro,
} from '../servicos/logicaUrna'
import { reiniciarSessaoVotacao } from '../estado/sessaoVotacao'
import type { EnvelopeArquivoCandidatos } from '../tipos/urna'

const router = useRouter()
const codigoUrna = ref('------')
const estaGerandoCodigo = ref(true)
const cargaCriptografada = ref('')
const hashEsperado = ref('')
const nomeArquivoSelecionado = ref('')
const estaImportando = ref(false)
const candidatosProntos = ref(false)
const mensagemImportacao = ref('')
const erroImportacao = ref('')

const podeValidarArquivo = computed(
  () =>
    !estaGerandoCodigo.value &&
    Boolean(cargaCriptografada.value) &&
    /^[a-f\d]{64}$/i.test(hashEsperado.value.trim()),
)
const podeIniciarVotacao = computed(() => candidatosProntos.value && !estaImportando.value)

onMounted(async () => {
  try {
    const urna = await inicializarUrna()
    codigoUrna.value = urna.codigo
    candidatosProntos.value = obterCandidatos().length > 0

    if (candidatosProntos.value) {
      mensagemImportacao.value = 'Uma carga de candidatos válida já está instalada nesta urna.'
    }
  } catch (erro) {
    erroImportacao.value = obterMensagemErro(erro, 'Não foi possível gerar o código desta urna.')
  } finally {
    estaGerandoCodigo.value = false
  }
})

function limparRetornoImportacao() {
  mensagemImportacao.value = ''
  erroImportacao.value = ''
  candidatosProntos.value = false
}

function atualizarHashEsperado(valor: string) {
  hashEsperado.value = valor
  limparRetornoImportacao()
}

async function selecionarArquivoCandidatos(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  const arquivo = entrada.files?.[0]

  if (!arquivo) return

  nomeArquivoSelecionado.value = arquivo.name
  cargaCriptografada.value = ''
  limparRetornoImportacao()

  try {
    const conteudoArquivo = (await arquivo.text()).trim()

    if (!conteudoArquivo) throw new Error('O arquivo selecionado está vazio.')

    try {
      const envelope = JSON.parse(conteudoArquivo) as EnvelopeArquivoCandidatos

      if (typeof envelope.encrypted !== 'string') {
        throw new Error('Envelope sem carga criptografada.')
      }

      cargaCriptografada.value = envelope.encrypted.trim()

      if (typeof envelope.hash === 'string') hashEsperado.value = envelope.hash.trim()
    } catch {
      cargaCriptografada.value = conteudoArquivo
    }
  } catch (erro) {
    erroImportacao.value = obterMensagemErro(erro, 'Não foi possível ler o arquivo selecionado.')
  }
}

async function validarArquivoCandidatos() {
  if (!podeValidarArquivo.value) return

  estaImportando.value = true
  mensagemImportacao.value = ''
  erroImportacao.value = ''

  try {
    const resultado = await importarCandidatosCriptografados(
      cargaCriptografada.value,
      hashEsperado.value.trim().toLowerCase(),
    )

    if (!resultado.valido) {
      throw new Error(`Hash divergente. Calculado pela urna: ${resultado.hashCalculado}`)
    }

    const totalCandidatos = resultado.candidatos.length
    candidatosProntos.value = true
    mensagemImportacao.value = `Carga validada com sucesso · ${totalCandidatos} candidato${totalCandidatos === 1 ? '' : 's'}.`
  } catch (erro) {
    candidatosProntos.value = false
    erroImportacao.value = obterMensagemErro(erro, 'Não foi possível validar a carga de candidatos.')
  } finally {
    estaImportando.value = false
  }
}

function iniciarVotacao() {
  if (!podeIniciarVotacao.value) return

  reiniciarSessaoVotacao()
  void router.replace({ name: 'votacao' })
}
</script>

<template>
  <main class="estrutura-pagina pagina-provisionamento">
    <section class="urna-eletronica urna-configuracao" aria-labelledby="titulo-configuracao">
      <CabecalhoUrna titulo="Preparação da urna" status="Terminal offline" />

      <div class="corpo-configuracao">
        <section class="introducao-configuracao">
          <p class="rotulo-secao">Provisionamento</p>
          <h1 id="titulo-configuracao">Prepare esta urna</h1>
          <p class="descricao-configuracao">
            Cadastre o código na apuração e carregue o arquivo de candidatos destinado a
            este terminal.
          </p>

          <CartaoCodigoUrna :codigo-publico="codigoUrna" :esta-gerando="estaGerandoCodigo" />
        </section>

        <CartaoArquivoCandidatos
          :nome-arquivo-selecionado="nomeArquivoSelecionado"
          :hash-esperado="hashEsperado"
          :pode-validar="podeValidarArquivo"
          :esta-importando="estaImportando"
          :mensagem="mensagemImportacao"
          :erro="erroImportacao"
          @selecionar-arquivo="selecionarArquivoCandidatos"
          @atualizar-hash="atualizarHashEsperado"
          @validar="validarArquivoCandidatos"
        />
      </div>

      <RodapeStatusConfiguracao
        :candidatos-prontos="candidatosProntos"
        :pode-iniciar="podeIniciarVotacao"
        @iniciar="iniciarVotacao"
      />
    </section>

    <AvisoPrivacidade texto="Código e arquivos permanecem armazenados somente neste terminal." />
  </main>
</template>
