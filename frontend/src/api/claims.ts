import { api } from './client'
import type { ClaimResponse, ReceivedClaimResponse } from '../types/api'

export function submitClaim(reportId: number, verificationAnswer: string, message: string | null) {
  return api<ClaimResponse>(`/claims/reports/${reportId}`, {
    method: 'POST',
    body: JSON.stringify({ verification_answer: verificationAnswer, message }),
  })
}

export function getMyClaims() {
  return api<ClaimResponse[]>('/claims/mine')
}

export function getReceivedClaims() {
  return api<ReceivedClaimResponse[]>('/claims/received')
}

export function withdrawClaim(claimId: number) {
  return api<ClaimResponse>(`/claims/${claimId}/withdraw`, { method: 'POST' })
}
