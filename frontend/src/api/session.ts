import type { UserSummary } from '../types/api'

const TOKEN_KEY = 'campus_lost_found_token'
const USER_KEY = 'campus_lost_found_user'

export function token(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function currentUser(): UserSummary | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserSummary
  } catch {
    clearSession()
    return null
  }
}

export function saveSession(accessToken: string, user: UserSummary): void {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
