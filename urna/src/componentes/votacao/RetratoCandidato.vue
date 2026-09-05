<script setup lang="ts">
import { computed } from 'vue'
import type { Candidato } from '../../tipos/urna'

const props = defineProps<{
  candidato: Candidato | null
  naoEncontrado: boolean
}>()

const fotoEmSvg = computed(() => props.candidato?.foto?.trim().startsWith('<svg') ?? false)
const fotoViceEmSvg = computed(
  () => props.candidato?.fotoVice?.trim().startsWith('<svg') ?? false,
)
</script>

<template>
  <div class="midia-candidato">
    <template v-if="candidato">
      <figure class="cartao-candidato">
        <div
          v-if="fotoEmSvg"
          class="foto-candidato foto-candidato-svg"
          role="img"
          :aria-label="`${candidato.nome}, candidato a prefeito`"
          v-html="candidato.foto"
        ></div>
        <img
          v-else
          class="foto-candidato"
          :src="candidato.foto"
          :alt="`${candidato.nome}, candidato a prefeito`"
        />
        <figcaption>
          <span>{{ candidato.numero }}</span>
          <small>Prefeito</small>
        </figcaption>
      </figure>

      <figure v-if="candidato.fotoVice" class="cartao-vice">
        <div
          v-if="fotoViceEmSvg"
          class="foto-vice foto-candidato-svg"
          role="img"
          :aria-label="`${candidato.nomeVice || 'Vice'}, candidato a vice-prefeito`"
          v-html="candidato.fotoVice"
        ></div>
        <img
          v-else
          class="foto-vice"
          :src="candidato.fotoVice"
          :alt="`${candidato.nomeVice || 'Vice'}, candidato a vice-prefeito`"
        />
        <figcaption>
          <small>Vice-prefeito</small>
          <strong>{{ candidato.nomeVice || 'Vice não informado' }}</strong>
        </figcaption>
      </figure>
    </template>

    <div
      v-else
      class="espaco-foto-candidato"
      :class="{ 'espaco-candidato-invalido': naoEncontrado }"
      role="status"
      aria-live="polite"
    >
      <div class="moldura-vazia" aria-hidden="true">
        <svg v-if="naoEncontrado" class="icone-candidato-invalido" viewBox="0 0 96 96" fill="none">
          <circle cx="48" cy="48" r="31" />
          <path d="m36 36 24 24M60 36 36 60" />
        </svg>
        <svg v-else viewBox="0 0 96 112" fill="none">
          <circle cx="48" cy="36" r="20" />
          <path d="M17 102c2-25 13-38 31-38s29 13 31 38" />
          <path class="linha-leitura" d="M12 55h72" />
        </svg>
      </div>
      <strong>{{ naoEncontrado ? 'Candidato não localizado' : 'Nenhum candidato selecionado' }}</strong>
      <small>{{ naoEncontrado ? 'Corrija o número para continuar' : 'Digite o número no teclado' }}</small>
    </div>
  </div>
</template>
