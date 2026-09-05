<script setup lang="ts">
import bartoAvatar from './assets/images/408-barto-avatar.svg'
import cachorroBobocaAvatar from './assets/images/408-cachorro-boboca-avatar.svg'

const voteNumber = ['4', '0', '8']
const keypadNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
</script>

<template>
  <main class="page-shell">
    <section class="voting-machine" aria-label="Urna eletrônica">
      <header class="machine-header">
        <div class="brand-copy">
          <p>Justiça Eleitoral</p>
          <strong>Urna eletrônica</strong>
        </div>

        <div class="terminal-status">
          <span class="status-dot" aria-hidden="true"></span>
          Terminal 01
        </div>
      </header>

      <div class="machine-body">
        <section class="ballot-screen" aria-labelledby="ballot-title">
          <div class="screen-topbar">
            <span>Seu voto</span>
            <span>Eleição municipal</span>
          </div>

          <div class="ballot-content">
            <div class="candidate-copy">
              <p class="eyebrow">Candidato</p>
              <h1 id="ballot-title">Vote para prefeito</h1>
              <p class="instruction">Digite o número do candidato no teclado ao lado.</p>

              <div class="candidate-number" aria-label="Número digitado: 408">
                <span
                  v-for="(digit, index) in voteNumber"
                  :key="`${digit}-${index}`"
                  :class="{ 'active-digit': index === voteNumber.length - 1 }"
                >
                  {{ digit }}
                </span>
              </div>

              <div class="candidate-details">
                <p class="candidate-name">Barto</p>
                <p class="candidate-party">Barto e Cachorro Boboca · Chapa 408</p>
              </div>
            </div>

            <div class="candidate-media">
              <figure class="candidate-card">
                <img
                  class="candidate-photo"
                  :src="bartoAvatar"
                  alt="Barto, candidato a prefeito"
                />
                <figcaption>
                  <span>408</span>
                  <small>Prefeito</small>
                </figcaption>
              </figure>

              <figure class="running-mate-card">
                <img
                  class="running-mate-photo"
                  :src="cachorroBobocaAvatar"
                  alt="Cachorro Boboca, candidato a vice-prefeito"
                />
                <figcaption>
                  <small>Vice</small>
                  <strong>Cachorro Boboca</strong>
                </figcaption>
              </figure>
            </div>
          </div>

          <footer class="screen-footer">
            <span><b>Branco</b> para votar em branco</span>
            <span><b>Corrige</b> para apagar</span>
            <span><b>Confirma</b> para concluir</span>
          </footer>
        </section>

        <section class="keypad-panel" aria-label="Teclado de votação">
          <div class="keypad-heading">
            <span>Teclado</span>
            <div class="accessibility-mark" aria-label="Símbolo de acessibilidade">●</div>
          </div>

          <div class="numeric-keypad">
            <button
              v-for="number in keypadNumbers"
              :key="number"
              type="button"
              :class="{ 'zero-key': number === '0' }"
            >
              {{ number }}
            </button>
          </div>

          <div class="action-keys">
            <button class="action-key blank-key" type="button"><span>Branco</span></button>
            <button class="action-key correct-key" type="button"><span>Corrige</span></button>
            <button class="action-key confirm-key" type="button"><span>Confirma</span></button>
          </div>
        </section>
      </div>
    </section>

    <p class="privacy-note">
      <span aria-hidden="true">◆</span>
      Seu voto é secreto e armazenado somente neste terminal.
    </p>
  </main>
</template>
