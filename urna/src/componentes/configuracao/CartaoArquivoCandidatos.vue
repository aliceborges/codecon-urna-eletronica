<script setup lang="ts">
defineProps<{
  nomeArquivoSelecionado: string
  hashEsperado: string
  podeValidar: boolean
  estaImportando: boolean
  mensagem: string
  erro: string
}>()

const emit = defineEmits<{
  selecionarArquivo: [evento: Event]
  atualizarHash: [valor: string]
  validar: []
}>()

function atualizarHash(evento: Event) {
  emit('atualizarHash', (evento.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="cartao-arquivo-configuracao" aria-labelledby="titulo-arquivo-candidatos">
    <span class="indicador-etapa">Etapa 2</span>
    <h2 id="titulo-arquivo-candidatos">Arquivo de candidatos</h2>
    <p class="descricao-carregamento">
      Selecione a carga criptografada gerada para o código desta urna.
    </p>

    <label class="area-arquivo" :class="{ 'com-arquivo': nomeArquivoSelecionado }">
      <input
        type="file"
        accept=".json,.txt,.enc,application/json,text/plain"
        @change="emit('selecionarArquivo', $event)"
      />
      <span class="icone-carregamento" aria-hidden="true">↑</span>
      <strong>{{ nomeArquivoSelecionado || 'Selecionar arquivo' }}</strong>
      <small>
        {{ nomeArquivoSelecionado ? 'Arquivo pronto para validação' : 'JSON, TXT ou ENC' }}
      </small>
    </label>

    <label class="campo-hash">
      <span>Hash SHA-256 do arquivo original</span>
      <input
        :value="hashEsperado"
        type="text"
        inputmode="text"
        maxlength="64"
        autocomplete="off"
        spellcheck="false"
        placeholder="Cole os 64 caracteres do hash"
        @input="atualizarHash"
      />
    </label>

    <button
      class="botao-validar-arquivo"
      type="button"
      :disabled="!podeValidar || estaImportando"
      @click="emit('validar')"
    >
      {{ estaImportando ? 'Validando…' : 'Validar carga' }}
    </button>

    <p v-if="mensagem" class="retorno-importacao retorno-sucesso" role="status">
      <span aria-hidden="true">✓</span>
      {{ mensagem }}
    </p>
    <p v-if="erro" class="retorno-importacao retorno-erro" role="alert">
      <span aria-hidden="true">!</span>
      {{ erro }}
    </p>
  </section>
</template>
