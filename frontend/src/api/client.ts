import { clearSession, token } from './session'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'
export const BACKEND_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '')

function detailMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) return String((item as { msg: unknown }).msg)
        return String(item)
      })
      .join(' ')
  }
  return 'The request could not be completed.'
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  const accessToken = token()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (response.status === 204) return undefined as T

  const data = await response.json().catch(() => ({})) as { detail?: unknown }
  if (!response.ok) {
    if (response.status === 401) clearSession()
    throw new Error(data.detail ? detailMessage(data.detail) : `Request failed (${response.status}).`)
  }
  return data as T
}

export function mediaUrl(path: string): string {
  return path.startsWith('http://') || path.startsWith('https://') ? path : `${BACKEND_ORIGIN}${path}`
}
