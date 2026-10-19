import { api } from './client'
import type { FlagReason, FlagResponse } from '../types/api'

export function flagReport(reportId: number, reason: FlagReason, details: string | null) {
  return api<FlagResponse>(`/flags/reports/${reportId}`, {
    method: 'POST',
    body: JSON.stringify({ reason, details }),
  })
}

export function getMyFlags() {
  return api<FlagResponse[]>('/flags/mine')
}
