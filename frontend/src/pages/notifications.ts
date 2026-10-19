import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications'
import { currentUser } from '../api/session'
import { emptyState, errorState, loadingState, pageHeader, toast } from '../components/ui'
import { icon } from '../components/icons'
import { dateTime } from '../utils/format'
import { esc, qs, setApp } from '../utils/html'

export async function renderNotifications(): Promise<void> {
  if (!currentUser()) { location.hash = '#/login'; return }
  setApp(`<div class="page-container">${pageHeader('Updates', 'Notifications', 'Claim activity, staff decisions and administrator actions are recorded here.', '<button id="readAll" class="btn btn-light border">Mark all as read</button>')}<div id="notificationsContent">${loadingState('Loading notifications…')}</div></div>`)
  try {
    const items = await getNotifications()
    qs<HTMLElement>('#notificationsContent').innerHTML = items.length ? `<div class="notification-list">${items.map((item) => `<article class="notification-item ${item.is_read ? '' : 'unread'}" data-id="${item.id}" data-link="${esc(item.link || '')}"><span class="notification-icon">${icon('bell')}</span><div><div class="notification-title"><strong>${esc(item.title)}</strong>${item.is_read ? '' : '<span>New</span>'}</div><p>${esc(item.message)}</p><small>${dateTime(item.created_at)}</small></div>${item.link ? `<button class="btn btn-sm btn-light border open-notification">Open</button>` : ''}</article>`).join('')}</div>` : emptyState('No notifications yet', 'Claim and moderation updates will appear here.')
    document.querySelectorAll<HTMLButtonElement>('.open-notification').forEach((button) => button.addEventListener('click', async () => {
      const item = button.closest<HTMLElement>('.notification-item')!
      try { await markNotificationRead(Number(item.dataset.id)); if (item.dataset.link) location.hash = item.dataset.link.replace(/^#/, '') } catch (error) { toast((error as Error).message, 'danger') }
    }))
    qs<HTMLButtonElement>('#readAll').addEventListener('click', async () => {
      try { await markAllNotificationsRead(); toast('Notifications marked as read.'); await renderNotifications() } catch (error) { toast((error as Error).message, 'danger') }
    })
  } catch (error) { qs<HTMLElement>('#notificationsContent').innerHTML = errorState((error as Error).message) }
}
