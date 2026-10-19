import { searchReports } from '../api/reports'
import { currentUser } from '../api/session'
import { reportCard } from '../components/report-card'
import { icon } from '../components/icons'
import { emptyState } from '../components/ui'
import { setApp, qs } from '../utils/html'

export async function renderHome(): Promise<void> {
  const user = currentUser()
  setApp(`<div class="home-page">
    <section class="hero-section">
      <div class="hero-copy">
        <div class="hero-kicker"><span></span> Campus item recovery, in one place</div>
        <h1>Lost something?<br><em>Start here.</em></h1>
        <p>Report a lost or found item, search current campus reports, and keep your own reports up to date.</p>
        <div class="hero-actions"><a class="btn btn-primary btn-lg" href="#/smart-search">${icon('sparkles')} Smart Search</a><a class="btn btn-light btn-lg border" href="#/reports">${icon('search')} Normal Search</a><a class="btn btn-light btn-lg border" href="${user ? '#/reports/new' : '#/login'}">${icon('plus')} Post a report</a></div>
        <div class="hero-trust"><span>${icon('shield')} Role-based access</span><span>${icon('lock')} Private verification details</span></div>
      </div>
    </section>

    <section class="home-section quick-actions-section">
      <div class="section-heading-row"><div><span class="eyebrow">Quick actions</span><h2>What do you need to do?</h2></div></div>
      <div class="quick-action-grid">
        <a class="quick-action" href="#/reports?type=LOST"><span class="quick-icon lost-icon">${icon('search')}</span><div><strong>I lost something</strong><p>Search Found reports or create a Lost report.</p></div>${icon('chevron')}</a>
        <a class="quick-action" href="${user ? '#/reports/new?type=FOUND' : '#/login'}"><span class="quick-icon found-icon">${icon('plus')}</span><div><strong>I found something</strong><p>Post the item so the owner can find it.</p></div>${icon('chevron')}</a>
        <a class="quick-action" href="${user ? '#/my-reports' : '#/login'}"><span class="quick-icon manage-icon">${icon('file')}</span><div><strong>Manage my reports</strong><p>Edit details, add images, or update report status.</p></div>${icon('chevron')}</a>
      </div>
    </section>

    <section class="home-section recent-section">
      <div class="section-heading-row"><div><span class="eyebrow">Current reports</span><h2>Latest reports</h2><p>Public reports currently marked as open.</p></div><a href="#/reports" class="section-link">View all ${icon('arrow')}</a></div>
      <div id="recentReports" class="report-grid"><div class="loading-state"><span class="spinner-border spinner-border-sm"></span> Loading latest reports…</div></div>
    </section>

  </div>`)

  try {
    const params = new URLSearchParams({ status: 'OPEN', limit: '6' })
    const result = await searchReports(params)
    qs<HTMLElement>('#recentReports').innerHTML = result.items.length
      ? result.items.map((report) => reportCard(report, true)).join('')
      : emptyState('No open reports yet', 'The first Lost or Found report will appear here.')
  } catch {
    qs<HTMLElement>('#recentReports').innerHTML = `<div class="soft-notice">${icon('info')} Latest reports are unavailable right now. You can still use the rest of the site.</div>`
  }
}
