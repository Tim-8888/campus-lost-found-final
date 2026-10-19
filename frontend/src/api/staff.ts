import { api } from './client'
import type { StaffClaimResponse } from '../types/api'

export function getStaffClaims(status?: string) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : ''
  return api<StaffClaimResponse[]>(`/staff/claims${suffix}`)
}

export function getStaffClaim(id: number) {
  return api<StaffClaimResponse>(`/staff/claims/${id}`)
}

export function reviewClaim(id: number, decision: 'APPROVED' | 'REJECTED', staffNote: string | null, storageNote: string | null) {
  return api<StaffClaimResponse>(`/staff/claims/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, staff_note: staffNote, storage_note: storageNote }),
  })
}

export function recordHandover(id: number, note: string | null) {
  return api<StaffClaimResponse>(`/staff/claims/${id}/handover`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}
