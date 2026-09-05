<script setup lang="ts">
import type { TipoVoto } from '../../estado/sessaoVotacao'

defineProps<{
  tipoVoto: TipoVoto
}>()

defineEmits<{
  proximoEleitor: []
}>()
</script>

<template>
  <section class="conteudo-sucesso" role="status" aria-live="polite">
    <div class="painel-sucesso">
      <div class="icone-sucesso" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="m8.5 16.4 5 5L24 10.9"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <p class="rotulo-secao">Voto concluído</p>
      <h1 id="titulo-sucesso">Voto confirmado</h1>
      <p class="descricao-sucesso">
        {{
          tipoVoto === 'branco'
            ? 'Seu voto em branco foi registrado com segurança.'
            : 'Seu voto foi registrado com segurança.'
        }}
      </p>

      <div class="comprovante-sucesso">
        <span>Terminal 01</span>
        <i aria-hidden="true"></i>
        <span>Registro local concluído</span>
      </div>

      <strong class="fim-sucesso">FIM</strong>

      <button class="botao-proximo-eleitor" type="button" @click="$emit('proximoEleitor')">
        Preparar para o próximo eleitor
        <span aria-hidden="true">→</span>
      </button>
    </div>
  </section>
</template>
