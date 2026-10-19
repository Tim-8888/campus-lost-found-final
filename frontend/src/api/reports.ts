import { api } from './client'
import type { ImageInfo, ReportPayload, ReportPrivate, ReportPublic, ReportStatus, SearchResponse } from '../types/api'

export function searchReports(params: URLSearchParams) {
  return api<SearchResponse>(`/reports/search?${params.toString()}`)
}

export function getReport(id: number) {
  return api<ReportPublic>(`/reports/${id}`)
}

export function getManageReport(id: number) {
  return api<ReportPrivate>(`/reports/${id}/manage`)
}

export function getMyReports() {
  return api<ReportPrivate[]>('/reports/mine')
}

export function createReport(payload: ReportPayload) {
  return api<ReportPrivate>('/reports', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateReport(id: number, payload: ReportPayload) {
  return api<ReportPrivate>(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function updateReportStatus(id: number, status: ReportStatus) {
  return api<ReportPrivate>(`/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function deleteReport(id: number) {
  return api<void>(`/reports/${id}`, { method: 'DELETE' })
}

export function uploadReportImage(id: number, file: File) {
  const body = new FormData()
  body.append('file', file)
  return api<ImageInfo>(`/reports/${id}/images`, { method: 'POST', body })
}

export function deleteReportImage(reportId: number, imageId: number) {
  return api<void>(`/reports/${reportId}/images/${imageId}`, { method: 'DELETE' })
}

export function markLostReportFound(id: number) {
  return api<ReportPrivate>(`/reports/${id}/mark-found`, { method: 'POST' })
}
