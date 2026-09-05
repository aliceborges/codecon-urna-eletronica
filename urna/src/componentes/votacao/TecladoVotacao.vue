<script setup lang="ts">
import audioBotaoUrna from "../../assets/audios/botao.mp3";

const numeros = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const inicioSomBotao = 0.053;
const audioBotao = new Audio(audioBotaoUrna);
audioBotao.preload = "auto";
audioBotao.load();

defineProps<{
  podeConfirmar: boolean
}>()

const emitir = defineEmits<{
  digito: [valor: string]
  branco: []
  corrigir: []
  confirmar: []
}>()

function tocarAudioBotao() {
  audioBotao.pause();
  audioBotao.currentTime = inicioSomBotao;
  void audioBotao.play().catch(() => undefined);
}

function acionarBotao(evento: "branco" | "corrigir" | "confirmar") {
  tocarAudioBotao();

  if (evento === "branco") emitir("branco");
  else if (evento === "corrigir") emitir("corrigir");
  else emitir("confirmar");
}

function inserirDigito(numero: string) {
  tocarAudioBotao();
  emitir("digito", numero);
}
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
        @click="inserirDigito(numero)"
      >
        {{ numero }}
      </button>
    </div>

    <div class="teclas-acao">
      <button class="tecla-acao tecla-branco" type="button" @click="acionarBotao('branco')">
        <span>Branco</span>
      </button>
      <button class="tecla-acao tecla-corrige" type="button" @click="acionarBotao('corrigir')">
        <span>Corrige</span>
      </button>
      <button
        class="tecla-acao tecla-confirma"
        type="button"
        :disabled="!podeConfirmar"
        @click="acionarBotao('confirmar')"
      >
        <span>Confirma</span>
      </button>
    </div>
  </section>
</template>
