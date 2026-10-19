import { getAdminStats } from '../api/admin'
import { currentUser } from '../api/session'
import { errorState, loadingState, pageHeader } from '../components/ui'
import { icon } from '../components/icons'
import { qs, setApp } from '../utils/html'

export async function renderAdminDashboard(): Promise<void> {
  const user = currentUser()
  if (!user) { location.hash = '#/login'; return }
  if (user.role !== 'ADMIN') {
    setApp(`<div class="page-container">${errorState('Administrator permission is required.')}</div>`)
    return
  }

  setApp(`<div class="page-container">
    ${pageHeader('Administration', 'Administrator dashboard', 'Review Lost and Found activity, unresolved cases, Claims, flags and account data.')}
    <div id="adminContent">${loadingState('Loading statistics…')}</div>
  </div>`)

  try {
    const s = await getAdminStats()
    qs<HTMLElement>('#adminContent').innerHTML = `
      <div class="admin-stat-grid">
        <div class="admin-stat"><span>${icon('file')}</span><div><strong>${s.lost_reports}</strong><small>Lost reports</small></div></div>
        <div class="admin-stat"><span>${icon('box')}</span><div><strong>${s.found_reports}</strong><small>Found reports</small></div></div>
        <div class="admin-stat"><span>${icon('claim')}</span><div><strong>${s.matched_reports}</strong><small>Matched reports</small></div></div>
        <div class="admin-stat"><span>${icon('shield')}</span><div><strong>${s.recovered_items}</strong><small>Recovered items</small></div></div>
        <div class="admin-stat"><span>${icon('search')}</span><div><strong>${s.unresolved_cases}</strong><small>Unresolved cases</small></div></div>
        <div class="admin-stat"><span>${icon('clipboard')}</span><div><strong>${s.pending_claims}</strong><small>Pending Claims</small></div></div>
        <div class="admin-stat"><span>${icon('flag')}</span><div><strong>${s.open_flags}</strong><small>Open flags</small></div></div>
        <div class="admin-stat"><span>${icon('users')}</span><div><strong>${s.active_users}</strong><small>Active users</small></div></div>
      </div>

      <div class="admin-module-grid">
        <a href="#/admin/users" class="admin-module">${icon('users')}<div><h3>User accounts</h3><p>Change roles and activate or deactivate accounts.</p></div>${icon('chevron')}</a>
        <a href="#/admin/references" class="admin-module">${icon('settings')}<div><h3>Categories & locations</h3><p>Maintain the reference data used by Reports and Search.</p></div>${icon('chevron')}</a>
        <a href="#/admin/reports" class="admin-module">${icon('file')}<div><h3>Report management</h3><p>Review all reports and control public visibility.</p></div>${icon('chevron')}</a>
        <a href="#/admin/flags" class="admin-module">${icon('flag')}<div><h3>Flagged content</h3><p>Resolve content reports and hide inappropriate listings.</p></div>${icon('chevron')}</a>
        <a href="#/staff" class="admin-module">${icon('clipboard')}<div><h3>Claim review</h3><p>Administrators can also access the staff Claim workflow.</p></div>${icon('chevron')}</a>
      </div>

      <div class="admin-summary-note"><strong>Current system totals</strong><span>${s.active_users}/${s.total_users} active users · ${s.total_claims} Claims · ${s.completed_claims} completed handovers.</span></div>`
  } catch (error) {
    qs<HTMLElement>('#adminContent').innerHTML = errorState((error as Error).message)
  }
}
