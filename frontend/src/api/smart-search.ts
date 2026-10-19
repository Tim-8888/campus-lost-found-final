import { api } from './client'
import type { SmartSearchExtractResponse, SmartSearchStatus } from '../types/api'

export function getSmartSearchStatus() {
  return api<SmartSearchStatus>('/smart-search/status')
}

export function extractSmartSearch(query: string) {
  return api<SmartSearchExtractResponse>('/smart-search/extract', {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}
