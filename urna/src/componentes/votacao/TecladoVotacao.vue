<script setup lang="ts">
const numeros = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

defineProps<{
  podeConfirmar: boolean
}>()

defineEmits<{
  digito: [valor: string]
  branco: []
  corrigir: []
  confirmar: []
}>()
</script>

<template>
  <section class="painel-teclado" aria-label="Teclado de votação">
    <div class="cabecalho-teclado">
      <span>Teclado</span>
      <div class="simbolo-acessibilidade" aria-label="Símbolo de acessibilidade">●</div>
    </div>

    <div class="teclado-numerico">
      <button
        v-for="numero in numeros"
        :key="numero"
        type="button"
        :class="{ 'tecla-zero': numero === '0' }"
        :aria-label="`Digitar ${numero}`"
        @click="$emit('digito', numero)"
      >
        {{ numero }}
      </button>
    </div>

    <div class="teclas-acao">
      <button class="tecla-acao tecla-branco" type="button" @click="$emit('branco')">
        <span>Branco</span>
      </button>
      <button class="tecla-acao tecla-corrige" type="button" @click="$emit('corrigir')">
        <span>Corrige</span>
      </button>
      <button
        class="tecla-acao tecla-confirma"
        type="button"
        :disabled="!podeConfirmar"
        @click="$emit('confirmar')"
      >
        <span>Confirma</span>
      </button>
    </div>
  </section>
</template>
