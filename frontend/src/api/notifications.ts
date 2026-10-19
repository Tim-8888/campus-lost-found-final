import { api } from './client'
import type { NotificationItem } from '../types/api'

export function getNotifications() {
  return api<NotificationItem[]>('/notifications')
}

export function getUnreadNotificationCount() {
  return api<{ unread: number }>('/notifications/unread-count')
}

export function markNotificationRead(id: number) {
  return api<NotificationItem>(`/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead() {
  return api<void>('/notifications/read-all', { method: 'POST' })
}
