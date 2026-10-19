import { getAdminFlags, resolveAdminFlag } from '../api/admin'
import { currentUser } from '../api/session'
import { emptyState, errorState, loadingState, pageHeader, toast } from '../components/ui'
import { icon } from '../components/icons'
import { esc, qs, setApp } from '../utils/html'
import { dateTime } from '../utils/format'

export async function renderAdminFlags(): Promise<void> {
  const user = currentUser()
  if (!user) { location.hash = '#/login'; return }
  if (user.role !== 'ADMIN') { setApp(`<div class="page-container">${errorState('Administrator permission is required.')}</div>`); return }
  setApp(`<div class="page-container">${pageHeader('Administration', 'Flagged content', 'Review reports flagged by users and record an administrator decision.', '<a class="btn btn-light border" href="#/admin">Back to dashboard</a>')}<div id="flagContent">${loadingState('Loading flags…')}</div></div>`)
  try {
    const flags = await getAdminFlags('OPEN')
    qs<HTMLElement>('#flagContent').innerHTML = flags.length ? `<div class="flag-list">${flags.map((flag) => `<article class="flag-card" data-id="${flag.id}"><div class="flag-card-head"><span class="flag-symbol">${icon('flag')}</span><div><strong>${esc(flag.reason)}</strong><span>Flag #${flag.id} · Report #${flag.report_id} · ${dateTime(flag.created_at)}</span></div><a class="btn btn-sm btn-light border" href="#/reports/${flag.report_id}">View report</a></div><p>${esc(flag.details || 'No additional details were supplied.')}</p><label class="form-label">Administrator note</label><textarea class="form-control resolution-note" rows="2" placeholder="Optional note explaining the decision."></textarea><div class="d-flex justify-content-end gap-2 mt-3"><button class="btn btn-light border flag-dismiss">Dismiss</button><button class="btn btn-outline-primary flag-resolve">Resolve</button><button class="btn btn-danger flag-hide">Resolve & hide report</button></div></article>`).join('')}</div>` : emptyState('No open content flags', 'There is nothing waiting for administrator review.')
    const handle = async (button: HTMLButtonElement, action: 'DISMISS' | 'RESOLVE' | 'HIDE_REPORT') => {
      const card = button.closest<HTMLElement>('.flag-card')!; const note = card.querySelector<HTMLTextAreaElement>('.resolution-note')!.value.trim() || null; button.disabled = true
      try { await resolveAdminFlag(Number(card.dataset.id), action, note); toast('Flag decision recorded.'); await renderAdminFlags() } catch (error) { toast((error as Error).message, 'danger'); button.disabled = false }
    }
    document.querySelectorAll<HTMLButtonElement>('.flag-dismiss').forEach((b) => b.addEventListener('click', () => void handle(b, 'DISMISS')))
    document.querySelectorAll<HTMLButtonElement>('.flag-resolve').forEach((b) => b.addEventListener('click', () => void handle(b, 'RESOLVE')))
    document.querySelectorAll<HTMLButtonElement>('.flag-hide').forEach((b) => b.addEventListener('click', () => void handle(b, 'HIDE_REPORT')))
  } catch (error) { qs<HTMLElement>('#flagContent').innerHTML = errorState((error as Error).message) }
}
