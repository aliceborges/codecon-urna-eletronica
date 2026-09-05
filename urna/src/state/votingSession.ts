import { ref } from 'vue'

export type VoteType = 'candidate' | 'blank'

export const lastVoteType = ref<VoteType>('candidate')
export const voteCompleted = ref(false)

export function completeVotingSession(type: VoteType) {
  lastVoteType.value = type
  voteCompleted.value = true
}

export function resetVotingSession() {
  voteCompleted.value = false
  lastVoteType.value = 'candidate'
}
