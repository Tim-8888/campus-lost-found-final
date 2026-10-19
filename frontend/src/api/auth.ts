import { api } from './client'
import type { TokenResponse, UserSummary } from '../types/api'

export function register(payload: { email: string; password: string; first_name: string; last_name: string }) {
  return api<UserSummary>('/auth/register', { method: 'POST', body: JSON.stringify(payload) })
}

export function login(payload: { email: string; password: string }) {
  return api<TokenResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) })
}
