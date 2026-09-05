<script setup lang="ts">
import { useRouter } from "vue-router";
import CabecalhoUrna from "../componentes/estrutura/CabecalhoUrna.vue";
import AvisoPrivacidade from "../componentes/estrutura/AvisoPrivacidade.vue";
import ConfirmacaoVoto from "../componentes/sucesso/ConfirmacaoVoto.vue";
import {
  reiniciarSessaoVotacao,
  ultimoTipoVoto,
} from "../estado/sessaoVotacao";

const roteador = useRouter();

function prepararProximoEleitor() {
  reiniciarSessaoVotacao();
  void roteador.replace({ name: "votacao" });
}
</script>

<template>
  <main class="estrutura-pagina pagina-sucesso">
    <section
      class="urna-eletronica urna-sucesso"
      aria-labelledby="titulo-sucesso"
    >
      <CabecalhoUrna titulo="Urna eletrônica" />
      <ConfirmacaoVoto
        :tipo-voto="ultimoTipoVoto"
        @proximo-eleitor="prepararProximoEleitor"
      />
    </section>

    <AvisoPrivacidade texto="O voto foi armazenado somente neste terminal." />
  </main>
</template>
