<script setup lang="ts">
import { computed } from 'vue'
import type { Candidato } from '../../tipos/urna'

const props = defineProps<{
  candidato: Candidato | null
  naoEncontrado: boolean
}>()

const vice = computed(() => {
  const valor = props.candidato?.fotoVice?.trim()

  if (!valor || valor.startsWith('<svg')) return null

  const [nome, ...partesPartido] = valor.split(',')
  return {
    nome: nome?.trim() || 'Vice não informado',
    partido: partesPartido.join(',').trim(),
  }
})
</script>

<template>
  <div v-if="candidato" class="detalhes-candidato" aria-live="polite">
    <p class="nome-candidato">{{ candidato.nome }}</p>
    <p class="partido-candidato">{{ candidato.partido }} · Chapa {{ candidato.numero }}</p>
    <p v-if="vice" class="vice-candidato">
      Vice: {{ vice.nome }}<template v-if="vice.partido">
        · {{ vice.partido }}</template
      >
    </p>
  </div>
  <div v-else-if="naoEncontrado" class="detalhes-candidato candidato-nao-encontrado" role="alert">
    <p class="nome-candidato">Número não encontrado</p>
    <p class="partido-candidato">Pressione Corrige e informe outro número.</p>
  </div>
  <div v-else class="detalhes-candidato candidato-pendente" aria-live="polite">
    <p class="nome-candidato">Aguardando número</p>
    <p class="partido-candidato">O candidato aparecerá após a digitação.</p>
  </div>
</template>
