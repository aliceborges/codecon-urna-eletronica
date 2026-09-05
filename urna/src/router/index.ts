import { createRouter, createWebHashHistory } from 'vue-router'
import UrnaFlow from '../components/UrnaFlow.vue'
import { resetVotingSession, voteCompleted } from '../state/votingSession'

function urnaIsConfigured() {
  try {
    return Boolean(window.UrnaFrontendLogic?.getCandidates().candidates?.length)
  } catch {
    return false
  }
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'voting',
      component: UrnaFlow,
      props: { screen: 'voting' },
    },
    {
      path: '/configuracao',
      name: 'setup',
      component: UrnaFlow,
      props: { screen: 'setup' },
    },
    {
      path: '/sucesso',
      name: 'success',
      component: UrnaFlow,
      props: { screen: 'success' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to, from) => {
  if (!urnaIsConfigured()) {
    resetVotingSession()

    if (to.name !== 'setup') return { name: 'setup' }
    return true
  }

  if (to.name === 'success' && !voteCompleted.value) {
    return { name: 'voting' }
  }

  if (from.name === 'success' && to.name === 'voting') {
    resetVotingSession()
  }

  return true
})

export default router
