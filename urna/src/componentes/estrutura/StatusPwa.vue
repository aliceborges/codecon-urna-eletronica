<script setup lang="ts">
import {
  aplicarAtualizacao,
  atualizacaoDisponivel,
  dispensarAvisoOffline,
  estaOnline,
  instalarPwa,
  podeInstalar,
  prontoParaOffline,
} from '../../estado/pwa'
</script>

<template>
  <aside
    v-if="atualizacaoDisponivel || prontoParaOffline || podeInstalar || !estaOnline"
    class="status-pwa"
    aria-live="polite"
    aria-atomic="true"
  >
    <template v-if="atualizacaoDisponivel">
      <span>Uma nova versão está disponível.</span>
      <button type="button" @click="aplicarAtualizacao">Atualizar agora</button>
    </template>

    <template v-else-if="!estaOnline">
      <span class="indicador-pwa" aria-hidden="true"></span>
      <span>Urna funcionando offline</span>
    </template>

    <template v-else-if="podeInstalar">
      <span>Instale a urna neste dispositivo.</span>
      <button type="button" @click="instalarPwa">Instalar</button>
    </template>

    <template v-else-if="prontoParaOffline">
      <span>Urna pronta para funcionar offline.</span>
      <button type="button" aria-label="Dispensar aviso" @click="dispensarAvisoOffline">
        Fechar
      </button>
    </template>
  </aside>
</template>
