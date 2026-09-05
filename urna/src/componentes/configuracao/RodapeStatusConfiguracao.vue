<script setup lang="ts">
defineProps<{
  candidatosProntos: boolean
  podeIniciar: boolean
}>()

defineEmits<{
  iniciar: []
}>()
</script>

<template>
  <footer class="rodape-configuracao">
    <div>
      <strong>{{ candidatosProntos ? 'Urna pronta' : 'Aguardando carga válida' }}</strong>
      <span>O processo de votação será liberado após a conferência.</span>
    </div>
    <button
      class="botao-iniciar-votacao"
      type="button"
      :disabled="!podeIniciar"
      @click="$emit('iniciar')"
    >
      Iniciar votação
      <span aria-hidden="true">→</span>
    </button>
  </footer>
</template>
