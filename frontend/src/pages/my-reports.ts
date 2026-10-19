import { deleteReport, getMyReports, markLostReportFound, updateReportStatus } from '../api/reports'
import { currentUser } from '../api/session'
import { mediaUrl } from '../api/client'
import type { ReportPrivate } from '../types/api'
import { icon } from '../components/icons'
import { confirmDialog, emptyState, errorState, loadingState, pageHeader, statusBadge, toast, typeBadge } from '../components/ui'
import { dateOnly } from '../utils/format'
import { esc, qs, setApp } from '../utils/html'
import { displayCategoryName } from '../utils/reference-label'

function managementCard(report: ReportPrivate): string {
  const image = report.images[0] ? `<img src="${mediaUrl(report.images[0].url)}" alt="${esc(displayCategoryName(report.category.name))}">` : `<div class="my-report-placeholder">${icon('image')}</div>`
  const statusAction = report.status === 'OPEN'
    ? report.report_type === 'LOST'
      ? `<button class="btn btn-sm btn-outline-success mark-found-action" data-id="${report.id}">Mark as found</button>`
      : `<button class="btn btn-sm btn-outline-warning status-action" data-id="${report.id}" data-status="CLOSED">Close listing</button>`
    : report.status === 'CLOSED'
      ? `<button class="btn btn-sm btn-outline-success status-action" data-id="${report.id}" data-status="OPEN">${report.report_type === 'LOST' ? 'Reopen search' : 'Reopen listing'}</button>`
      : ''
  const closedNote = report.report_type === 'LOST' && report.status === 'CLOSED' ? '<small class="text-success">This Lost report is closed because the item was found or the search ended.</small>' : ''
  return `<article class="my-report-card" data-status="${esc(report.status)}">
    <div class="my-report-image">${image}</div><div class="my-report-content"><div class="d-flex gap-2 mb-2">${typeBadge(report.report_type)}${statusBadge(report.status)}</div><h3>${esc(displayCategoryName(report.category.name))}</h3><p>${esc(report.description.length > 100 ? `${report.description.slice(0, 100)}…` : report.description)}</p><div class="my-report-meta"><span>${icon('location')} ${esc(report.location.name)}</span><span>${icon('calendar')} ${dateOnly(report.item_date)}</span></div>${closedNote}</div>
    <div class="my-report-actions"><a class="btn btn-sm btn-light border" href="#/reports/${report.id}">${icon('eye')} View</a><a class="btn btn-sm btn-light border" href="#/reports/edit/${report.id}">${icon('edit')} Edit</a>${statusAction}<button class="icon-button danger delete-action" data-id="${report.id}" aria-label="Delete report">${icon('trash')}</button></div>
  </article>`
}


export async function renderMyReports(): Promise<void> {
  if (!currentUser()) { location.hash = '#/login'; return }
  setApp(`<div class="page-container">${pageHeader('Account', 'My Reports', 'Review, edit and update the status of reports created by your account.', `<a class="btn btn-primary" href="#/reports/new">${icon('plus')} New report</a>`)}<div id="myReportsContent">${loadingState('Loading your reports…')}</div></div>`)
  try {
    const reports = await getMyReports()
    if (!reports.length) { qs<HTMLElement>('#myReportsContent').innerHTML = emptyState('No reports yet', 'Create your first Lost or Found report to start using this area.', `<a class="btn btn-primary" href="#/reports/new">${icon('plus')} Create report</a>`); return }
    const open = reports.filter((r) => r.status === 'OPEN').length
    const closed = reports.filter((r) => r.status === 'CLOSED').length
    const returned = reports.filter((r) => r.status === 'RETURNED').length
    qs<HTMLElement>('#myReportsContent').innerHTML = `<div class="report-summary-row"><button class="summary-stat active" data-filter="ALL"><span>${reports.length}</span><small>All reports</small></button><button class="summary-stat" data-filter="OPEN"><span>${open}</span><small>Open</small></button><button class="summary-stat" data-filter="CLOSED"><span>${closed}</span><small>Closed</small></button><button class="summary-stat" data-filter="RETURNED"><span>${returned}</span><small>Returned</small></button></div><div id="myReportsList" class="my-reports-list">${reports.map(managementCard).join('')}</div>`
    document.querySelectorAll<HTMLButtonElement>('.summary-stat').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('.summary-stat').forEach((item) => item.classList.remove('active')); button.classList.add('active'); const filter = button.dataset.filter
      document.querySelectorAll<HTMLElement>('.my-report-card').forEach((card) => { card.hidden = filter !== 'ALL' && card.dataset.status !== filter })
    }))
    document.querySelectorAll<HTMLButtonElement>('.mark-found-action').forEach((button) => button.addEventListener('click', async () => {
      const okay = await confirmDialog('Mark this Lost item as found?', 'The report will stay a Lost report, but its status will change from OPEN to CLOSED. You can reopen the search later if needed.', 'Mark as found')
      if (!okay) return
      try { await markLostReportFound(Number(button.dataset.id)); toast('Lost item marked as found.'); await renderMyReports() } catch (error) { toast((error as Error).message, 'danger') }
    }))
    document.querySelectorAll<HTMLButtonElement>('.status-action').forEach((button) => button.addEventListener('click', async () => {
      try { const next = String(button.dataset.status) as 'OPEN' | 'CLOSED'; await updateReportStatus(Number(button.dataset.id), next); toast(next === 'OPEN' ? 'Report reopened.' : 'Report closed.'); await renderMyReports() } catch (error) { toast((error as Error).message, 'danger') }
    }))
    document.querySelectorAll<HTMLButtonElement>('.delete-action').forEach((button) => button.addEventListener('click', async () => {
      const okay = await confirmDialog('Delete this report?', 'The report and its uploaded images will be permanently deleted.', 'Delete report'); if (!okay) return
      try { await deleteReport(Number(button.dataset.id)); toast('Report deleted.'); await renderMyReports() } catch (error) { toast((error as Error).message, 'danger') }
    }))
  } catch (error) { qs<HTMLElement>('#myReportsContent').innerHTML = errorState((error as Error).message) }
}
