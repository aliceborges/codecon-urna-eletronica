<script setup lang="ts">
defineProps<{
  texto: string
}>()
</script>

<template>
  <p class="aviso-privacidade">
    <span aria-hidden="true">◆</span>
    {{ texto }}
  </p>
</template>
