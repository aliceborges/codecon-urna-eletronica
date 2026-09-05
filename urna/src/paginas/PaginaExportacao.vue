<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CabecalhoUrna from '../componentes/estrutura/CabecalhoUrna.vue'
import AvisoPrivacidade from '../componentes/estrutura/AvisoPrivacidade.vue'
import {
  criarArquivoBoletim,
  exportarBoletimVotacao,
  obterApuracaoLocal,
  obterMensagemErro,
} from '../servicos/logicaUrna'
import type { ResultadoExportacaoVotacao } from '../tipos/urna'

const roteador = useRouter()
const identificadorTerminal = ref('terminal-01')
const totalVotos = ref(0)
const totalOpcoes = ref(0)
const estaExportando = ref(false)
const resultado = ref<ResultadoExportacaoVotacao | null>(null)
const nomeArquivo = ref('')
const erroExportacao = ref('')
const hashCopiado = ref(false)

const identificadorValido = computed(() => Boolean(identificadorTerminal.value.trim()))
const dataEmissao = computed(() => {
  if (!resultado.value) return ''

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(resultado.value.report.issued_at))
})

onMounted(() => {
  const { contagem, total } = obterApuracaoLocal()
  totalVotos.value = total
  totalOpcoes.value = Object.keys(contagem).length
})

function limparResultado() {
  resultado.value = null
  nomeArquivo.value = ''
  erroExportacao.value = ''
  hashCopiado.value = false
}

function baixarArquivo(conteudo: string, nome: string) {
  const arquivo = new Blob([conteudo], { type: 'application/json;charset=utf-8' })
  const endereco = URL.createObjectURL(arquivo)
  const link = document.createElement('a')

  link.href = endereco
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(endereco), 0)
}

function baixarNovamente() {
  if (!resultado.value) return

  const arquivo = criarArquivoBoletim(resultado.value)
  baixarArquivo(arquivo.conteudo, arquivo.nome)
}

async function gerarBoletim() {
  if (!identificadorValido.value || estaExportando.value) return

  estaExportando.value = true
  erroExportacao.value = ''
  hashCopiado.value = false

  try {
    const boletim = await exportarBoletimVotacao(identificadorTerminal.value)
    const arquivo = criarArquivoBoletim(boletim)

    resultado.value = boletim
    nomeArquivo.value = arquivo.nome
    baixarArquivo(arquivo.conteudo, arquivo.nome)
  } catch (erro) {
    resultado.value = null
    erroExportacao.value = obterMensagemErro(
      erro,
      'Não foi possível gerar o boletim desta urna.',
    )
  } finally {
    estaExportando.value = false
  }
}

async function copiarHash() {
  if (!resultado.value) return

  try {
    await navigator.clipboard.writeText(resultado.value.hash)
    hashCopiado.value = true
  } catch {
    erroExportacao.value = 'Não foi possível copiar o hash. Selecione-o manualmente.'
  }
}
</script>

<template>
  <main class="estrutura-pagina pagina-exportacao">
    <section class="urna-eletronica urna-exportacao" aria-labelledby="titulo-exportacao">
      <CabecalhoUrna titulo="Encerramento da votação" status="Terminal offline" />

      <div class="corpo-exportacao">
        <section class="introducao-exportacao">
          <p class="rotulo-secao">Transmissão segura</p>
          <h1 id="titulo-exportacao">Exporte o boletim da urna</h1>
          <p class="descricao-exportacao">
            Gere o arquivo criptografado e leve-o ao serviço de apuração junto com o hash
            de conferência.
          </p>

          <div class="resumo-votacao" aria-label="Resumo da votação local">
            <div>
              <span>Total registrado</span>
              <strong>{{ totalVotos }}</strong>
              <small>voto{{ totalVotos === 1 ? '' : 's' }}</small>
            </div>
            <div>
              <span>Opções na urna</span>
              <strong>{{ totalOpcoes }}</strong>
              <small>incluindo branco, se houver</small>
            </div>
          </div>

          <div class="garantias-exportacao">
            <div aria-hidden="true" class="icone-cadeado">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
              </svg>
            </div>
            <div>
              <strong>Protegido pelo código da urna</strong>
              <span>AES-256-GCM · Integridade SHA-256 · Processamento offline</span>
            </div>
          </div>
        </section>

        <section class="cartao-exportacao" aria-labelledby="titulo-boletim">
          <span class="indicador-etapa">Etapa final</span>
          <h2 id="titulo-boletim">Boletim de votação</h2>
          <p class="descricao-carregamento">
            Identifique o terminal antes de gerar o arquivo para a apuração.
          </p>

          <label class="campo-terminal">
            <span>Identificador do terminal</span>
            <input
              v-model="identificadorTerminal"
              type="text"
              maxlength="80"
              autocomplete="off"
              spellcheck="false"
              placeholder="Ex.: terminal-01"
              :disabled="estaExportando"
              @input="limparResultado"
            />
          </label>

          <button
            v-if="!resultado"
            class="botao-gerar-boletim"
            type="button"
            :disabled="!identificadorValido || estaExportando"
            @click="gerarBoletim"
          >
            <span class="icone-download" aria-hidden="true">↓</span>
            {{ estaExportando ? 'Criptografando…' : 'Gerar e baixar boletim' }}
          </button>

          <div v-else class="resultado-exportacao" role="status" aria-live="polite">
            <div class="cabecalho-resultado-exportacao">
              <span class="selo-sucesso-exportacao" aria-hidden="true">✓</span>
              <div>
                <strong>Boletim exportado</strong>
                <small>{{ nomeArquivo }} · {{ dataEmissao }}</small>
              </div>
            </div>

            <div class="hash-exportacao">
              <span>Hash SHA-256 do conteúdo original</span>
              <code>{{ resultado.hash }}</code>
              <button type="button" @click="copiarHash">
                {{ hashCopiado ? 'Hash copiado' : 'Copiar hash' }}
              </button>
            </div>

            <div class="acoes-resultado-exportacao">
              <button class="botao-baixar-novamente" type="button" @click="baixarNovamente">
                Baixar novamente
              </button>
              <button class="botao-gerar-novo" type="button" @click="limparResultado">
                Gerar novo arquivo
              </button>
            </div>
          </div>

          <p v-if="erroExportacao" class="retorno-importacao retorno-erro" role="alert">
            <span aria-hidden="true">!</span>
            {{ erroExportacao }}
          </p>

          <p class="nota-exportacao">
            O arquivo contém somente o envelope criptografado e o hash. Nenhum voto
            individual é exposto.
          </p>
        </section>
      </div>

      <footer class="rodape-exportacao">
        <button class="botao-voltar-votacao" type="button" @click="roteador.push({ name: 'votacao' })">
          <span aria-hidden="true">←</span>
          Voltar para votação
        </button>
        <p>
          <strong>{{ resultado ? 'Arquivo pronto para apuração' : 'Boletim ainda não gerado' }}</strong>
          <span>{{ resultado ? 'Confira o hash ao importar.' : 'A contagem permanece salva neste terminal.' }}</span>
        </p>
      </footer>
    </section>

    <AvisoPrivacidade texto="A exportação acontece localmente e não envia dados pela internet." />
  </main>
</template>
