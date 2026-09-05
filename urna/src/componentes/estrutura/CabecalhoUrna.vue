<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo: string
    status?: string
  }>(),
  {
    status: 'Terminal 01',
  },
)
</script>

<template>
  <header class="cabecalho-urna">
    <div class="identificacao-urna">
      <p>Justiça Eleitoral</p>
      <strong>{{ titulo }}</strong>
    </div>

    <div class="status-terminal">
      <span class="indicador-status" aria-hidden="true"></span>
      {{ status }}
    </div>
  </header>
</template>
