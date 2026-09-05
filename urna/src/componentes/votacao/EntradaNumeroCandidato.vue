<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  valor: string
  quantidade: number
}>()

const digitos = computed(() =>
  Array.from({ length: props.quantidade }, (_, indice) => props.valor[indice] ?? ''),
)
</script>

<template>
  <div
    class="numero-candidato"
    :aria-label="`Número digitado: ${valor || 'nenhum'}`"
    aria-live="polite"
  >
    <span
      v-for="(digito, indice) in digitos"
      :key="`${digito}-${indice}`"
      :class="{
        'digito-ativo': indice === valor.length && valor.length < quantidade,
        'digito-preenchido': Boolean(digito),
      }"
    >
      {{ digito || '\u00a0' }}
    </span>
  </div>
</template>
