import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

type ResultadoInstalacao = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

interface EventoInstalacaoPwa extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<ResultadoInstalacao>
}

export const estaOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
export const podeInstalar = ref(false)
export const atualizacaoDisponivel = ref(false)
export const prontoParaOffline = ref(false)

let eventoInstalacao: EventoInstalacaoPwa | null = null
let pwaInicializado = false

const atualizarServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    atualizacaoDisponivel.value = true
  },
  onOfflineReady() {
    prontoParaOffline.value = true
  },
  onRegisterError(erro) {
    console.error('Não foi possível ativar o modo offline da urna.', erro)
  },
})

export function inicializarPwa() {
  if (pwaInicializado || typeof window === 'undefined') return
  pwaInicializado = true

  window.addEventListener('online', () => {
    estaOnline.value = true
  })

  window.addEventListener('offline', () => {
    estaOnline.value = false
  })

  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault()
    eventoInstalacao = evento as EventoInstalacaoPwa
    podeInstalar.value = true
  })

  window.addEventListener('appinstalled', () => {
    eventoInstalacao = null
    podeInstalar.value = false
  })
}

export async function instalarPwa() {
  if (!eventoInstalacao) return

  const evento = eventoInstalacao
  await evento.prompt()
  await evento.userChoice
  eventoInstalacao = null
  podeInstalar.value = false
}

export async function aplicarAtualizacao() {
  atualizacaoDisponivel.value = false
  await atualizarServiceWorker(true)
}

export function dispensarAvisoOffline() {
  prontoParaOffline.value = false
}
