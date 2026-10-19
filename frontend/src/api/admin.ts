import { api } from './client'
import type { AdminReference, AdminReport, AdminStats, AdminUser, FlagResponse } from '../types/api'

export function getAdminStats() { return api<AdminStats>('/admin/stats') }
export function getAdminUsers() { return api<AdminUser[]>('/admin/users') }
export function updateAdminUser(id: number, payload: { role?: string; is_active?: boolean }) {
  return api<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function getAdminCategories() { return api<AdminReference[]>('/admin/categories') }
export function createAdminCategory(name: string) {
  return api<AdminReference>('/admin/categories', { method: 'POST', body: JSON.stringify({ name }) })
}
export function updateAdminCategory(id: number, payload: { name?: string; is_active?: boolean }) {
  return api<AdminReference>(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function getAdminLocations() { return api<AdminReference[]>('/admin/locations') }
export function createAdminLocation(name: string) {
  return api<AdminReference>('/admin/locations', { method: 'POST', body: JSON.stringify({ name }) })
}
export function updateAdminLocation(id: number, payload: { name?: string; is_active?: boolean }) {
  return api<AdminReference>(`/admin/locations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function getAdminReports() { return api<AdminReport[]>('/admin/reports') }
export function setAdminReportVisibility(id: number, isPublic: boolean) {
  return api<AdminReport>(`/admin/reports/${id}/visibility`, { method: 'PATCH', body: JSON.stringify({ is_public: isPublic }) })
}

export function getAdminFlags(status?: string) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : ''
  return api<FlagResponse[]>(`/admin/flags${suffix}`)
}
export function resolveAdminFlag(id: number, action: 'DISMISS' | 'RESOLVE' | 'HIDE_REPORT', note: string | null) {
  return api<FlagResponse>(`/admin/flags/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action, note }) })
}
