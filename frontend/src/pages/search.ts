import { getReferences } from '../api/references'
import { searchReports } from '../api/reports'
import { reportCard } from '../components/report-card'
import { icon } from '../components/icons'
import { emptyState, errorState, loadingState, pageHeader } from '../components/ui'
import { esc, qs, setApp } from '../utils/html'
import { displayCategoryName } from '../utils/reference-label'

function initialParams(): URLSearchParams {
  const hash = location.hash
  const query = hash.includes('?') ? hash.split('?')[1] : ''
  return new URLSearchParams(query)
}

export async function renderSearch(): Promise<void> {
  setApp(`<div class="page-container">${pageHeader('Search', 'Find a campus item', 'Use normal search filters to narrow the current public Lost and Found reports.', `<div class="d-flex gap-2 flex-wrap"><a class="btn btn-light border" href="#/smart-search">${icon('sparkles')} Smart Search</a><a class="btn btn-primary" href="#/reports/new">${icon('plus')} Post a report</a></div>`)}<div id="searchContent">${loadingState('Preparing search…')}</div></div>`)
  try {
    const refs = await getReferences()
    const initial = initialParams()
    const selectedType = initial.get('report_type') || initial.get('type') || ''
    const selectedCategory = initial.get('category_id') || ''
    const selectedLocation = initial.get('location_id') || ''
    const selectedStatus = initial.get('status') || 'OPEN'
    const selectedPhoto = initial.get('has_photo') || ''
    const categoryOptions = refs.categories.map((item) => `<option value="${item.id}" ${selectedCategory === String(item.id) ? 'selected' : ''}>${esc(displayCategoryName(item.name))}</option>`).join('')
    const locationOptions = refs.locations.map((item) => `<option value="${item.id}" ${selectedLocation === String(item.id) ? 'selected' : ''}>${esc(item.name)}</option>`).join('')
    qs<HTMLElement>('#searchContent').innerHTML = `<div class="search-layout">
      <aside class="search-filter-card"><div class="filter-heading"><div>${icon('filter')}<span><strong>Search filters</strong><small>Refine public reports</small></span></div><button class="btn-reset" id="resetSearch" type="button">Reset</button></div><form id="searchForm">
        <div class="filter-group"><label for="keyword">Keyword</label><div class="input-with-icon">${icon('search')}<input class="form-control" id="keyword" name="keyword" value="${esc(initial.get('keyword') || '')}" placeholder="e.g. charger, wallet"></div></div>
        <div class="filter-group"><label for="reportType">Report type</label><select class="form-select" id="reportType" name="report_type"><option value="">Lost &amp; Found</option><option value="LOST" ${selectedType === 'LOST' ? 'selected' : ''}>Lost</option><option value="FOUND" ${selectedType === 'FOUND' ? 'selected' : ''}>Found</option></select></div>
        <div class="filter-group"><label for="category">Category</label><select class="form-select" id="category" name="category_id"><option value="">All categories</option>${categoryOptions}</select></div>
        <div class="filter-group"><label for="location">Location</label><select class="form-select" id="location" name="location_id"><option value="">All locations</option>${locationOptions}</select></div>
        <div class="filter-group"><label for="colour">Colour</label><input class="form-control" id="colour" name="colour" value="${esc(initial.get('colour') || '')}" placeholder="Any colour"></div>
        <div class="filter-group"><label for="statusFilter">Status</label><select class="form-select" id="statusFilter" name="status"><option value="OPEN" ${selectedStatus === 'OPEN' ? 'selected' : ''}>Open</option><option value="CLOSED" ${selectedStatus === 'CLOSED' ? 'selected' : ''}>Closed</option><option value="RETURNED" ${selectedStatus === 'RETURNED' ? 'selected' : ''}>Returned</option><option value="ALL" ${selectedStatus === 'ALL' ? 'selected' : ''}>All statuses</option></select></div>
        <div class="row g-2"><div class="col-6"><div class="filter-group"><label for="dateFrom">From</label><input class="form-control" id="dateFrom" name="date_from" type="date" value="${esc(initial.get('date_from') || '')}"></div></div><div class="col-6"><div class="filter-group"><label for="dateTo">To</label><input class="form-control" id="dateTo" name="date_to" type="date" value="${esc(initial.get('date_to') || '')}"></div></div></div>
        <div class="filter-group"><label for="hasPhoto">Photos</label><select class="form-select" id="hasPhoto" name="has_photo"><option value="" ${!selectedPhoto ? 'selected' : ''}>Any</option><option value="true" ${selectedPhoto === 'true' ? 'selected' : ''}>Has photo</option><option value="false" ${selectedPhoto === 'false' ? 'selected' : ''}>No photo</option></select></div>
        <button class="btn btn-primary w-100 mt-2" type="submit">${icon('search')} Search reports</button>
      </form></aside>
      <section class="search-results"><div class="results-toolbar"><div><strong id="resultCount">Reports</strong><span id="resultDescription">Public reports</span></div><div class="view-note">${icon('info')} Private verification details are never shown here.</div></div><div id="resultsGrid" class="report-grid">${loadingState('Searching reports…')}</div></section>
    </div>`

    const runSearch = async () => {
      const form = qs<HTMLFormElement>('#searchForm')
      const data = new FormData(form)
      const params = new URLSearchParams({ limit: '100' })
      for (const [key, value] of data.entries()) {
        const text = String(value).trim()
        if (!text) continue
        if (key === 'status' && text === 'ALL') continue
        params.set(key, text)
      }
      qs<HTMLElement>('#resultsGrid').innerHTML = loadingState('Searching reports…')
      try {
        const result = await searchReports(params)
        qs<HTMLElement>('#resultCount').textContent = `${result.total} report${result.total === 1 ? '' : 's'}`
        qs<HTMLElement>('#resultDescription').textContent = qs<HTMLSelectElement>('#statusFilter').value === 'ALL' ? 'All public report statuses' : `${qs<HTMLSelectElement>('#statusFilter').selectedOptions[0].text} public reports`
        qs<HTMLElement>('#resultsGrid').innerHTML = result.items.length ? result.items.map((item) => reportCard(item)).join('') : emptyState('No matching reports', 'Try removing one or more filters, or post a new report if your item is not listed.', `<a class="btn btn-primary" href="#/reports/new">Post a report</a>`)
      } catch (error) {
        qs<HTMLElement>('#resultsGrid').innerHTML = errorState((error as Error).message)
      }
    }

    qs<HTMLFormElement>('#searchForm').addEventListener('submit', (event) => { event.preventDefault(); void runSearch() })
    qs<HTMLButtonElement>('#resetSearch').addEventListener('click', () => {
      qs<HTMLFormElement>('#searchForm').reset()
      qs<HTMLSelectElement>('#statusFilter').value = 'OPEN'
      void runSearch()
    })
    await runSearch()
  } catch (error) {
    qs<HTMLElement>('#searchContent').innerHTML = errorState((error as Error).message)
  }
}
