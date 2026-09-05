<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  completeVotingSession,
  lastVoteType,
  resetVotingSession,
} from '../state/votingSession'

const props = defineProps<{
  screen: 'setup' | 'voting' | 'success'
}>()

const router = useRouter()

type Candidate = {
  number: string
  name: string
  party: string
  photo: string
  photo_vice?: string
}

type UrnaKeys = {
  publicId: string
}

type CandidateImportResult = {
  ok: boolean
  computed: string
  obj: {
    candidates?: Candidate[]
  }
}

type CandidateFileEnvelope = {
  encrypted?: string
  hash?: string
}

type UrnaLogic = {
  initIfNeeded: () => Promise<UrnaKeys>
  getCandidates: () => { candidates?: Candidate[] }
  inputNumber: (number: string) => Candidate | null
  confirmVote: (number: string) => Record<string, number>
  importEncryptedCandidates: (
    encryptedBase64: string,
    expectedHashHex: string,
  ) => Promise<CandidateImportResult>
}

declare global {
  interface Window {
    UrnaFrontendLogic?: UrnaLogic
  }
}

const keypadNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

const voteNumber = ref('')
const candidates = ref<Candidate[]>([])
const publicId = ref('------')
const isGeneratingCode = ref(true)
const encryptedPayload = ref('')
const expectedHash = ref('')
const selectedFileName = ref('')
const isImporting = ref(false)
const candidatesReady = ref(false)
const importMessage = ref('')
const importError = ref('')

const publicIdDigits = computed(() => publicId.value.padEnd(6, '-').slice(0, 6).split(''))
const canValidateFile = computed(
  () =>
    !isGeneratingCode.value &&
    Boolean(encryptedPayload.value) &&
    /^[a-f\d]{64}$/i.test(expectedHash.value.trim()),
)
const canStartVoting = computed(() => candidatesReady.value && !isImporting.value)
const numberOfDigits = computed(() => {
  const largestNumber = candidates.value.reduce(
    (largest, candidate) => Math.max(largest, String(candidate.number).length),
    0,
  )

  return largestNumber || 3
})
const displayedDigits = computed(() =>
  Array.from({ length: numberOfDigits.value }, (_, index) => voteNumber.value[index] ?? ''),
)
const selectedCandidate = computed(() => {
  if (!voteNumber.value) return null

  return getUrnaLogic().inputNumber(voteNumber.value)
})
const numberIsComplete = computed(() => voteNumber.value.length === numberOfDigits.value)
const candidateNotFound = computed(() => numberIsComplete.value && !selectedCandidate.value)
const canConfirmCandidate = computed(() => Boolean(selectedCandidate.value))
const candidatePhotoIsSvg = computed(() =>
  selectedCandidate.value?.photo?.trim().startsWith('<svg') ?? false,
)
const runningMate = computed(() => {
  const rawValue = selectedCandidate.value?.photo_vice?.trim()

  if (!rawValue || rawValue.startsWith('<svg')) return null

  const [name, ...partyParts] = rawValue.split(',')
  return {
    name: name?.trim() || 'Vice não informado',
    party: partyParts.join(',').trim(),
  }
})

onMounted(async () => {
  try {
    const logic = getUrnaLogic()
    const keys = await logic.initIfNeeded()
    publicId.value = keys.publicId
    candidates.value = logic.getCandidates().candidates ?? []
    candidatesReady.value = Boolean(candidates.value.length)

    if (candidatesReady.value) {
      importMessage.value = 'Uma carga de candidatos válida já está instalada nesta urna.'
    }
  } catch (error) {
    importError.value = getErrorMessage(error, 'Não foi possível gerar o código desta urna.')
  } finally {
    isGeneratingCode.value = false
  }
})

onMounted(() => window.addEventListener('keydown', handlePhysicalKeyboard))
onUnmounted(() => window.removeEventListener('keydown', handlePhysicalKeyboard))

function getUrnaLogic(): UrnaLogic {
  if (!window.UrnaFrontendLogic) {
    throw new Error('A lógica de provisionamento da urna não foi carregada.')
  }

  return window.UrnaFrontendLogic
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

async function selectCandidatesFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  selectedFileName.value = file.name
  encryptedPayload.value = ''
  importMessage.value = ''
  importError.value = ''
  candidatesReady.value = false

  try {
    const fileContent = (await file.text()).trim()

    if (!fileContent) {
      throw new Error('O arquivo selecionado está vazio.')
    }

    try {
      const envelope = JSON.parse(fileContent) as CandidateFileEnvelope

      if (typeof envelope.encrypted !== 'string') {
        throw new Error('Envelope sem carga criptografada.')
      }

      encryptedPayload.value = envelope.encrypted.trim()

      if (typeof envelope.hash === 'string') {
        expectedHash.value = envelope.hash.trim()
      }
    } catch {
      encryptedPayload.value = fileContent
    }
  } catch (error) {
    importError.value = getErrorMessage(error, 'Não foi possível ler o arquivo selecionado.')
  }
}

async function validateCandidatesFile() {
  if (!canValidateFile.value) return

  isImporting.value = true
  importMessage.value = ''
  importError.value = ''

  try {
    const result = await getUrnaLogic().importEncryptedCandidates(
      encryptedPayload.value,
      expectedHash.value.trim().toLowerCase(),
    )

    if (!result.ok) {
      throw new Error(`Hash divergente. Calculado pela urna: ${result.computed}`)
    }

    const totalCandidates = result.obj.candidates?.length ?? 0
    candidates.value = result.obj.candidates ?? []
    candidatesReady.value = true
    importMessage.value = `Carga validada com sucesso · ${totalCandidates} candidato${totalCandidates === 1 ? '' : 's'}.`
  } catch (error) {
    candidatesReady.value = false
    importError.value = getErrorMessage(error, 'Não foi possível validar a carga de candidatos.')
  } finally {
    isImporting.value = false
  }
}

function startVoting() {
  if (!canStartVoting.value) return
  clearVoteNumber()
  resetVotingSession()
  void router.replace({ name: 'voting' })
}

function finishVote(type: 'candidate' | 'blank') {
  if (type === 'candidate' && !canConfirmCandidate.value) return

  const voteKey = type === 'blank' ? 'blank' : voteNumber.value

  getUrnaLogic().confirmVote(voteKey)
  completeVotingSession(type)
  void router.push({ name: 'success' })
}

function prepareNextVoter() {
  clearVoteNumber()
  resetVotingSession()
  void router.replace({ name: 'voting' })
}

function inputDigit(digit: string) {
  if (voteNumber.value.length >= numberOfDigits.value) return

  voteNumber.value += digit
}

function clearVoteNumber() {
  voteNumber.value = ''
}

function handlePhysicalKeyboard(event: KeyboardEvent) {
  if (props.screen !== 'voting') return

  if (/^\d$/.test(event.key)) {
    inputDigit(event.key)
    return
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault()
    clearVoteNumber()
  }
}
</script>

<template>
  <main v-if="screen === 'setup'" class="page-shell provision-page">
    <section class="voting-machine setup-machine" aria-labelledby="setup-title">
      <header class="machine-header">
        <div class="brand-copy">
          <p>Justiça Eleitoral</p>
          <strong>Preparação da urna</strong>
        </div>

        <div class="terminal-status">
          <span class="status-dot" aria-hidden="true"></span>
          Terminal offline
        </div>
      </header>

      <div class="setup-body">
        <section class="setup-intro">
          <p class="eyebrow">Provisionamento</p>
          <h1 id="setup-title">Prepare esta urna</h1>
          <p class="setup-description">
            Cadastre o código na apuração e carregue o arquivo de candidatos destinado a
            este terminal.
          </p>

          <div class="terminal-code-card" :aria-busy="isGeneratingCode">
            <div class="terminal-code-heading">
              <span>Código único da urna</span>
              <span class="code-state">
                <i aria-hidden="true"></i>
                {{ isGeneratingCode ? 'Gerando' : 'Gerado' }}
              </span>
            </div>

            <div class="terminal-code" :aria-label="`Código da urna: ${publicId}`">
              <span v-for="(digit, index) in publicIdDigits" :key="`${digit}-${index}`">
                {{ digit }}
              </span>
            </div>

            <p>
              Este código identifica a urna e permanece salvo somente neste dispositivo.
            </p>
          </div>
        </section>

        <section class="setup-upload-card" aria-labelledby="upload-title">
          <span class="step-badge">Etapa 2</span>
          <h2 id="upload-title">Arquivo de candidatos</h2>
          <p class="upload-description">
            Selecione a carga criptografada gerada para o código desta urna.
          </p>

          <label class="file-dropzone" :class="{ 'has-file': selectedFileName }">
            <input
              type="file"
              accept=".json,.txt,.enc,application/json,text/plain"
              @change="selectCandidatesFile"
            />
            <span class="upload-icon" aria-hidden="true">↑</span>
            <strong>{{ selectedFileName || 'Selecionar arquivo' }}</strong>
            <small>
              {{ selectedFileName ? 'Arquivo pronto para validação' : 'JSON, TXT ou ENC' }}
            </small>
          </label>

          <label class="hash-field">
            <span>Hash SHA-256 do arquivo original</span>
            <input
              v-model="expectedHash"
              type="text"
              inputmode="text"
              maxlength="64"
              autocomplete="off"
              spellcheck="false"
              placeholder="Cole os 64 caracteres do hash"
              @input="importMessage = ''; importError = ''; candidatesReady = false"
            />
          </label>

          <button
            class="validate-file-button"
            type="button"
            :disabled="!canValidateFile || isImporting"
            @click="validateCandidatesFile"
          >
            {{ isImporting ? 'Validando…' : 'Validar carga' }}
          </button>

          <p v-if="importMessage" class="import-feedback success-feedback" role="status">
            <span aria-hidden="true">✓</span>
            {{ importMessage }}
          </p>
          <p v-if="importError" class="import-feedback error-feedback" role="alert">
            <span aria-hidden="true">!</span>
            {{ importError }}
          </p>
        </section>
      </div>

      <footer class="setup-footer">
        <div>
          <strong>{{ candidatesReady ? 'Urna pronta' : 'Aguardando carga válida' }}</strong>
          <span>O processo de votação será liberado após a conferência.</span>
        </div>
        <button
          class="start-voting-button"
          type="button"
          :disabled="!canStartVoting"
          @click="startVoting"
        >
          Iniciar votação
          <span aria-hidden="true">→</span>
        </button>
      </footer>
    </section>

    <p class="privacy-note">
      <span aria-hidden="true">◆</span>
      Chaves e arquivos permanecem armazenados somente neste terminal.
    </p>
  </main>

  <main v-else-if="screen === 'voting'" class="page-shell">
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

              <div
                class="candidate-number"
                :aria-label="`Número digitado: ${voteNumber || 'nenhum'}`"
                aria-live="polite"
              >
                <span
                  v-for="(digit, index) in displayedDigits"
                  :key="`${digit}-${index}`"
                  :class="{
                    'active-digit': index === voteNumber.length && voteNumber.length < numberOfDigits,
                    'filled-digit': Boolean(digit),
                  }"
                >
                  {{ digit || '\u00a0' }}
                </span>
              </div>

              <div v-if="selectedCandidate" class="candidate-details" aria-live="polite">
                <p class="candidate-name">{{ selectedCandidate.name }}</p>
                <p class="candidate-party">
                  {{ selectedCandidate.party }} · Chapa {{ selectedCandidate.number }}
                </p>
                <p v-if="runningMate" class="candidate-running-mate">
                  Vice: {{ runningMate.name }}<template v-if="runningMate.party"> · {{ runningMate.party }}</template>
                </p>
              </div>
              <div v-else-if="candidateNotFound" class="candidate-details candidate-not-found" role="alert">
                <p class="candidate-name">Número não encontrado</p>
                <p class="candidate-party">Pressione Corrige e informe outro número.</p>
              </div>
              <div v-else class="candidate-details candidate-pending" aria-live="polite">
                <p class="candidate-name">Aguardando número</p>
                <p class="candidate-party">O candidato aparecerá após a digitação.</p>
              </div>
            </div>

            <div class="candidate-media">
              <figure v-if="selectedCandidate" class="candidate-card">
                <div
                  v-if="candidatePhotoIsSvg"
                  class="candidate-photo candidate-photo-markup"
                  role="img"
                  :aria-label="`${selectedCandidate.name}, candidato a prefeito`"
                  v-html="selectedCandidate.photo"
                ></div>
                <img
                  v-else
                  class="candidate-photo"
                  :src="selectedCandidate.photo"
                  :alt="`${selectedCandidate.name}, candidato a prefeito`"
                />
                <figcaption>
                  <span>{{ selectedCandidate.number }}</span>
                  <small>Prefeito</small>
                </figcaption>
              </figure>
              <div
                v-else
                class="candidate-photo-placeholder"
                :class="{ 'invalid-candidate-placeholder': candidateNotFound }"
                role="status"
                aria-live="polite"
              >
                <div class="placeholder-frame" aria-hidden="true">
                  <svg
                    v-if="candidateNotFound"
                    class="invalid-candidate-icon"
                    viewBox="0 0 96 96"
                    fill="none"
                  >
                    <circle cx="48" cy="48" r="31" />
                    <path d="m36 36 24 24M60 36 36 60" />
                  </svg>
                  <svg v-else viewBox="0 0 96 112" fill="none">
                    <circle cx="48" cy="36" r="20" />
                    <path d="M17 102c2-25 13-38 31-38s29 13 31 38" />
                    <path class="placeholder-scan-line" d="M12 55h72" />
                  </svg>
                </div>
                <strong>
                  {{ candidateNotFound ? 'Candidato não localizado' : 'Nenhum candidato selecionado' }}
                </strong>
                <small>
                  {{ candidateNotFound ? 'Corrija o número para continuar' : 'Digite o número no teclado' }}
                </small>
              </div>
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
              :aria-label="`Digitar ${number}`"
              @click="inputDigit(number)"
            >
              {{ number }}
            </button>
          </div>

          <div class="action-keys">
            <button class="action-key blank-key" type="button" @click="finishVote('blank')">
              <span>Branco</span>
            </button>
            <button class="action-key correct-key" type="button" @click="clearVoteNumber">
              <span>Corrige</span>
            </button>
            <button
              class="action-key confirm-key"
              type="button"
              :disabled="!canConfirmCandidate"
              @click="finishVote('candidate')"
            >
              <span>Confirma</span>
            </button>
          </div>
        </section>
      </div>
    </section>

    <p class="privacy-note">
      <span aria-hidden="true">◆</span>
      Seu voto é secreto e armazenado somente neste terminal.
    </p>
  </main>

  <main v-else class="page-shell success-page">
    <section class="voting-machine success-machine" aria-labelledby="success-title">
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

      <section class="success-content" role="status" aria-live="polite">
        <div class="success-panel">
          <div class="success-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="m8.5 16.4 5 5L24 10.9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>

          <p class="eyebrow">Voto concluído</p>
          <h1 id="success-title">Voto confirmado</h1>
          <p class="success-description">
            {{
              lastVoteType === 'blank'
                ? 'Seu voto em branco foi registrado com segurança.'
                : 'Seu voto foi registrado com segurança.'
            }}
          </p>

          <div class="success-receipt">
            <span>Terminal 01</span>
            <i aria-hidden="true"></i>
            <span>Registro local concluído</span>
          </div>

          <strong class="success-end">FIM</strong>

          <button class="next-voter-button" type="button" @click="prepareNextVoter">
            Preparar para o próximo eleitor
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </section>

    <p class="privacy-note">
      <span aria-hidden="true">◆</span>
      O voto foi armazenado somente neste terminal.
    </p>
  </main>
</template>
