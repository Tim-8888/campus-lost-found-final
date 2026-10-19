import { icon } from './icons'
import { esc } from '../utils/html'

export function pageHeader(eyebrow: string, title: string, text: string, actions = ''): string {
  return `<section class="page-heading">
    <div>
      <div class="eyebrow">${esc(eyebrow)}</div>
      <h1>${esc(title)}</h1>
      <p>${esc(text)}</p>
    </div>
    ${actions ? `<div class="page-heading-actions">${actions}</div>` : ''}
  </section>`
}

export function loadingState(text = 'Loading…'): string {
  return `<div class="loading-state" role="status"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>${esc(text)}</span></div>`
}

export function emptyState(title: string, text: string, action = ''): string {
  return `<div class="empty-state">
    <div class="empty-icon">${icon('search')}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${action}
  </div>`
}

export function errorState(message: string): string {
  return `<div class="alert alert-danger border-0 shadow-sm d-flex gap-2 align-items-start" role="alert">${icon('alert', 'icon mt-1')}<div>${esc(message)}</div></div>`
}

export function statusBadge(status: string): string {
  const normalized = status.toUpperCase()
  const css = normalized === 'OPEN' ? 'status-open' : normalized === 'RETURNED' ? 'status-returned' : 'status-closed'
  return `<span class="status-badge ${css}">${esc(normalized)}</span>`
}

export function typeBadge(type: string): string {
  const normalized = type.toUpperCase()
  return `<span class="type-badge ${normalized === 'LOST' ? 'type-lost' : 'type-found'}">${esc(normalized === 'LOST' ? 'Lost' : 'Found')}</span>`
}

export function toast(message: string, tone: 'success' | 'danger' | 'info' = 'success'): void {
  const root = document.querySelector<HTMLDivElement>('#toast-root')
  if (!root) return
  const item = document.createElement('div')
  item.className = `app-toast app-toast-${tone}`
  item.innerHTML = `<div>${tone === 'success' ? icon('check') : tone === 'danger' ? icon('alert') : icon('info')}</div><div class="flex-grow-1">${esc(message)}</div><button type="button" aria-label="Dismiss">${icon('close')}</button>`
  root.appendChild(item)
  item.querySelector('button')?.addEventListener('click', () => item.remove())
  setTimeout(() => item.remove(), 4200)
}

export function confirmDialog(title: string, message: string, confirmText = 'Confirm'): Promise<boolean> {
  return new Promise((resolve) => {
    const wrapper = document.createElement('div')
    wrapper.className = 'app-modal-backdrop'
    wrapper.innerHTML = `<div class="app-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="app-modal-icon">${icon('alert')}</div>
      <h3 id="confirm-title">${esc(title)}</h3>
      <p>${esc(message)}</p>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button class="btn btn-light border" data-action="cancel">Cancel</button>
        <button class="btn btn-danger" data-action="confirm">${esc(confirmText)}</button>
      </div>
    </div>`
    document.body.appendChild(wrapper)
    const finish = (value: boolean) => { wrapper.remove(); resolve(value) }
    wrapper.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish(false))
    wrapper.querySelector('[data-action="confirm"]')?.addEventListener('click', () => finish(true))
    wrapper.addEventListener('click', (event) => { if (event.target === wrapper) finish(false) })
  })
}
