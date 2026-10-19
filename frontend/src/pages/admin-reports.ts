import { getAdminReports, setAdminReportVisibility } from '../api/admin'
import { currentUser } from '../api/session'
import { errorState, loadingState, pageHeader, toast, statusBadge, typeBadge } from '../components/ui'
import { esc, qs, setApp } from '../utils/html'
import { dateTime } from '../utils/format'

export async function renderAdminReports(): Promise<void> {
  const user = currentUser()
  if (!user) { location.hash = '#/login'; return }
  if (user.role !== 'ADMIN') { setApp(`<div class="page-container">${errorState('Administrator permission is required.')}</div>`); return }
  setApp(`<div class="page-container">${pageHeader('Administration', 'Report management', 'Review all report records and control whether a report is visible in public Search.', '<a class="btn btn-light border" href="#/admin">Back to dashboard</a>')}<div id="reportAdminContent">${loadingState('Loading reports…')}</div></div>`)
  try {
    const reports = await getAdminReports()
    qs<HTMLElement>('#reportAdminContent').innerHTML = `<div class="table-shell"><table class="table align-middle mb-0 admin-table"><thead><tr><th>Report</th><th>Owner</th><th>Status</th><th>Visibility</th><th>Flags</th><th></th></tr></thead><tbody>${reports.map((r) => `<tr data-id="${r.id}"><td><strong>#${r.id} · ${esc(r.category)}</strong><small>${typeBadge(r.report_type)} ${esc(r.colour)} · ${esc(r.location)} · ${dateTime(r.created_at)}</small></td><td>${esc(r.owner_email)}</td><td>${statusBadge(r.status)}</td><td><select class="form-select form-select-sm visibility"><option value="true" ${r.is_public ? 'selected' : ''}>Public</option><option value="false" ${!r.is_public ? 'selected' : ''}>Hidden</option></select></td><td>${r.open_flags ? `<span class="flag-count">${r.open_flags} open</span>` : '0'}</td><td><div class="d-flex gap-2 justify-content-end"><a class="btn btn-sm btn-light border" href="#/reports/${r.id}">View</a><button class="btn btn-sm btn-primary save-visibility">Save</button></div></td></tr>`).join('')}</tbody></table></div>`
    document.querySelectorAll<HTMLButtonElement>('.save-visibility').forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest<HTMLTableRowElement>('tr')!; const id = Number(row.dataset.id); const visible = row.querySelector<HTMLSelectElement>('.visibility')!.value === 'true'; button.disabled = true
      try { await setAdminReportVisibility(id, visible); toast('Report visibility updated.') } catch (error) { toast((error as Error).message, 'danger') } finally { button.disabled = false }
    }))
  } catch (error) { qs<HTMLElement>('#reportAdminContent').innerHTML = errorState((error as Error).message) }
}
