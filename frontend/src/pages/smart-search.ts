import { extractSmartSearch, getSmartSearchStatus } from '../api/smart-search'
import { getReferences } from '../api/references'
import { searchReports } from '../api/reports'
import { reportCard } from '../components/report-card'
import { icon } from '../components/icons'
import { emptyState, errorState, loadingState, pageHeader } from '../components/ui'
import type { SmartSearchExtractResponse } from '../types/api'
import { esc, qs, setApp } from '../utils/html'
import { displayCategoryName } from '../utils/reference-label'

function optionList(items: { id: number; name: string }[], selected: number | null, category = false): string {
  return items.map((item) => `<option value="${item.id}" ${selected === item.id ? 'selected' : ''}>${esc(category ? displayCategoryName(item.name) : item.name)}</option>`).join('')
}

function warningList(items: string[]): string {
  if (!items.length) return ''
  return `<div class="smart-warning-list">${items.map((item) => `<div>${icon('alert')}<span>${esc(item)}</span></div>`).join('')}</div>`
}

export async function renderSmartSearch(): Promise<void> {
  setApp(`<div class="page-container">
    ${pageHeader('Smart Search', 'Describe the item in one sentence', 'Gemini extracts search fields. You can check and change every field before the database search starts.', `<a class="btn btn-light border" href="#/reports">${icon('filter')} Normal Search</a>`)}
    <section class="smart-search-shell">
      <div class="smart-query-card">
        <div class="smart-query-heading"><span>${icon('sparkles')}</span><div><strong>Natural-language search</strong><small>Example: I lost a black Type-C charger near the library yesterday.</small></div></div>
        <form id="smartQueryForm">
          <label class="form-label" for="smartQuery">Search sentence</label>
          <textarea class="form-control" id="smartQuery" rows="4" maxlength="500" placeholder="Describe what you lost or found, including useful details such as colour, place and date."></textarea>
          <div class="smart-query-footer"><small id="smartPrivacy">Only your search sentence is processed. Do not include passwords or Claim answers.</small><button class="btn btn-primary" id="analyseSmart" type="submit">${icon('sparkles')} Analyse sentence</button></div>
        </form>
        <div id="smartStatus" class="mt-3"></div>
      </div>
      <div id="smartContent"></div>
    </section>
  </div>`)

  const [refs, status] = await Promise.all([getReferences(), getSmartSearchStatus()])
  qs<HTMLElement>('#smartPrivacy').textContent = status.privacy_note
  if (!status.enabled) {
    qs<HTMLElement>('#smartStatus').innerHTML = `<div class="soft-notice">${icon('info')} Smart Search is not configured on this backend yet. Add the Gemini API key to the backend .env file. <a href="#/reports">Normal Search</a> is still available.</div>`
  }

  const renderConfirmation = (result: SmartSearchExtractResponse) => {
    const f = result.fields
    const keywords = f.keywords.join(' ')
    qs<HTMLElement>('#smartContent').innerHTML = `<div class="smart-confirm-card">
      <div class="smart-step-head"><div><span class="eyebrow">Check the result</span><h2>Confirm search fields</h2><p>Gemini suggested these fields using ${esc(result.model)}. Change anything that is not correct before searching.</p></div><span class="smart-step-number">2</span></div>
      ${warningList(result.warnings)}
      <form id="smartConfirmForm" class="smart-confirm-grid">
        <div><label class="form-label" for="smartReportType">Report type</label><select class="form-select" id="smartReportType" name="report_type"><option value="">Any type</option><option value="LOST" ${f.report_type === 'LOST' ? 'selected' : ''}>Lost</option><option value="FOUND" ${f.report_type === 'FOUND' ? 'selected' : ''}>Found</option></select></div>
        <div><label class="form-label" for="smartStatusField">Status</label><select class="form-select" id="smartStatusField" name="status"><option value="OPEN" ${f.status === 'OPEN' ? 'selected' : ''}>Open</option><option value="CLOSED">Closed</option><option value="RETURNED">Returned</option><option value="ALL">All statuses</option></select></div>
        <div><label class="form-label" for="smartCategory">Category</label><select class="form-select" id="smartCategory" name="category_id"><option value="">Any category</option>${optionList(refs.categories, f.category_id, true)}</select></div>
        <div><label class="form-label" for="smartLocation">Location</label><select class="form-select" id="smartLocation" name="location_id"><option value="">Any location</option>${optionList(refs.locations, f.location_id)}</select></div>
        <div><label class="form-label" for="smartColour">Colour</label><input class="form-control" id="smartColour" name="colour" value="${esc(f.colour || '')}" placeholder="Any colour"></div>
        <div><label class="form-label" for="smartKeywords">Keywords</label><input class="form-control" id="smartKeywords" name="keyword" value="${esc(keywords)}" placeholder="Extra keywords"></div>
        <div><label class="form-label" for="smartDateFrom">From date</label><input class="form-control" id="smartDateFrom" name="date_from" type="date" value="${esc(f.date_from || '')}"></div>
        <div><label class="form-label" for="smartDateTo">To date</label><input class="form-control" id="smartDateTo" name="date_to" type="date" value="${esc(f.date_to || '')}"></div>
        <div class="smart-confirm-actions"><button class="btn btn-primary" type="submit">${icon('search')} Search with these fields</button><a class="btn btn-light border" href="#/reports">Use Normal Search instead</a></div>
      </form>
    </div><section id="smartResults" class="smart-results-section"></section>`

    qs<HTMLFormElement>('#smartConfirmForm').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = qs<HTMLFormElement>('#smartConfirmForm')
      const data = new FormData(form)
      const params = new URLSearchParams({ limit: '100' })
      for (const [key, value] of data.entries()) {
        const text = String(value).trim()
        if (!text) continue
        if (key === 'status' && text === 'ALL') continue
        params.set(key, text)
      }
      const root = qs<HTMLElement>('#smartResults')
      root.innerHTML = loadingState('Searching the database…')
      try {
        const reports = await searchReports(params)
        root.innerHTML = `<div class="results-toolbar"><div><strong>${reports.total} report${reports.total === 1 ? '' : 's'}</strong><span>Results from the confirmed Smart Search fields</span></div><a class="section-link" href="#/reports">Open Normal Search ${icon('arrow')}</a></div><div class="report-grid">${reports.items.length ? reports.items.map((item) => reportCard(item)).join('') : emptyState('No matching reports', 'Change one or more confirmed fields and search again.')}</div>`
      } catch (error) {
        root.innerHTML = errorState((error as Error).message)
      }
    })
  }

  qs<HTMLFormElement>('#smartQueryForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const query = qs<HTMLTextAreaElement>('#smartQuery').value.trim()
    if (query.length < 3) {
      qs<HTMLElement>('#smartContent').innerHTML = errorState('Please enter a longer search sentence.')
      return
    }
    const button = qs<HTMLButtonElement>('#analyseSmart')
    button.disabled = true
    button.textContent = 'Analysing…'
    qs<HTMLElement>('#smartContent').innerHTML = loadingState('Gemini is extracting search fields…')
    try {
      const result = await extractSmartSearch(query)
      renderConfirmation(result)
    } catch (error) {
      qs<HTMLElement>('#smartContent').innerHTML = `${errorState((error as Error).message)}<div class="mt-3"><a class="btn btn-primary" href="#/reports">Use Normal Search</a></div>`
    } finally {
      button.disabled = false
      button.innerHTML = `${icon('sparkles')} Analyse sentence`
    }
  })
}
