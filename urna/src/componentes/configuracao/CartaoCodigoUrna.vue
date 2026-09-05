<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  codigoPublico: string
  estaGerando: boolean
}>()

const digitos = computed(() => props.codigoPublico.padEnd(6, '-').slice(0, 6).split(''))
</script>

<template>
  <div class="cartao-codigo-terminal" :aria-busy="estaGerando">
    <div class="cabecalho-codigo-terminal">
      <span>Código único da urna</span>
      <span class="estado-codigo">
        <i aria-hidden="true"></i>
        {{ estaGerando ? 'Gerando' : 'Gerado' }}
      </span>
    </div>

    <div class="codigo-terminal" :aria-label="`Código da urna: ${codigoPublico}`">
      <span v-for="(digito, indice) in digitos" :key="`${digito}-${indice}`">
        {{ digito }}
      </span>
    </div>

    <p>Este código identifica a urna e permanece salvo somente neste dispositivo.</p>
  </div>
</template>
