<script setup lang="ts">
import type { Candidato } from '../../tipos/urna'

defineProps<{
  candidato: Candidato | null
  naoEncontrado: boolean
}>()
</script>

<template>
  <div v-if="candidato" class="detalhes-candidato" aria-live="polite">
    <p class="nome-candidato">{{ candidato.nome }}</p>
    <p class="partido-candidato">{{ candidato.partido }} · Chapa {{ candidato.numero }}</p>
    <p v-if="candidato.nomeVice" class="vice-candidato">Vice: {{ candidato.nomeVice }}</p>
  </div>
  <div v-else-if="naoEncontrado" class="detalhes-candidato candidato-nao-encontrado" role="alert">
    <p class="nome-candidato">404</p>
    <p class="partido-candidato">Candidato não encontrado - Pressione Corrige e informe outro número.</p>
  </div>
  <div v-else class="detalhes-candidato candidato-pendente" aria-live="polite">
    <p class="nome-candidato">Aguardando número</p>
    <p class="partido-candidato">O candidato aparecerá após a digitação.</p>
  </div>
</template>
