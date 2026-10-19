import { mediaUrl } from '../api/client'
import { getMyReports, getReport } from '../api/reports'
import { flagReport } from '../api/flags'
import { currentUser } from '../api/session'
import { icon } from '../components/icons'
import { errorState, loadingState, statusBadge, toast, typeBadge } from '../components/ui'
import { dateOnly } from '../utils/format'
import { esc, qs, setApp } from '../utils/html'
import type { FlagReason } from '../types/api'
import { displayCategoryName } from '../utils/reference-label'

function openFlagDialog(reportId: number): void {
  const wrapper = document.createElement('div')
  wrapper.className = 'app-modal-backdrop'
  wrapper.innerHTML = `<div class="app-modal app-modal-wide"><div class="app-modal-icon">${icon('flag')}</div><h3>Report this listing</h3><p>Send this report to an administrator if the content appears misleading, inappropriate, duplicated or spam.</p><label class="form-label">Reason</label><select class="form-select" id="flagReason"><option value="MISLEADING">Misleading information</option><option value="INAPPROPRIATE">Inappropriate content</option><option value="DUPLICATE">Duplicate report</option><option value="SPAM">Spam</option><option value="OTHER">Other</option></select><label class="form-label mt-3">Details</label><textarea id="flagDetails" class="form-control" rows="3" maxlength="1000" placeholder="Explain why this report should be reviewed."></textarea><div class="d-flex justify-content-end gap-2 mt-4"><button class="btn btn-light border" data-action="cancel">Cancel</button><button class="btn btn-danger" data-action="submit">Submit flag</button></div></div>`
  document.body.appendChild(wrapper)
  wrapper.querySelector('[data-action="cancel"]')?.addEventListener('click', () => wrapper.remove())
  wrapper.addEventListener('click', (e) => { if (e.target === wrapper) wrapper.remove() })
  wrapper.querySelector<HTMLButtonElement>('[data-action="submit"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement; button.disabled = true
    try {
      await flagReport(reportId, qs<HTMLSelectElement>('#flagReason', wrapper).value as FlagReason, qs<HTMLTextAreaElement>('#flagDetails', wrapper).value.trim() || null)
      wrapper.remove(); toast('Report sent to an administrator for review.')
    } catch (error) { toast((error as Error).message, 'danger'); button.disabled = false }
  })
}

export async function renderReportDetail(id: number): Promise<void> {
  setApp(`<div class="page-container"><div id="detailContent">${loadingState('Loading report…')}</div></div>`)
  try {
    const user = currentUser()
    const [report, mine] = await Promise.all([getReport(id), user ? getMyReports().catch(() => []) : Promise.resolve([])])
    const isOwner = mine.some((item) => item.id === id)
    const claimReady = Boolean(report.verification_question)
    const canClaim = Boolean(user?.role === 'STUDENT' && !isOwner && report.report_type === 'FOUND' && report.status === 'OPEN' && claimReady)
    const imageGallery = report.images.length
      ? `<div class="detail-gallery ${report.images.length === 1 ? 'single' : ''}">${report.images.map((img, index) => `<a href="${mediaUrl(img.url)}" target="_blank" rel="noreferrer" class="gallery-item ${index === 0 ? 'gallery-main' : ''}"><img src="${mediaUrl(img.url)}" alt="Report photo ${index + 1}"></a>`).join('')}</div>`
      : `<div class="detail-gallery-empty">${icon('image', 'placeholder-icon')}<strong>No photos were added</strong><span>The report can still be identified using its written details.</span></div>`

    let actions = ''
    if (isOwner) actions = `<a class="btn btn-primary" href="#/reports/edit/${report.id}">${icon('edit')} Manage report</a>`
    else if (canClaim) actions = `<a class="btn btn-primary" href="#/reports/${report.id}/claim">${icon('claim')} Claim this item</a>`
    else if (!user && report.report_type === 'FOUND' && report.status === 'OPEN') actions = `<a class="btn btn-primary" href="#/login">Log in to Claim</a>`

    qs<HTMLElement>('#detailContent').innerHTML = `<div class="detail-breadcrumb"><a href="#/reports">Search reports</a>${icon('chevron')}<span>${esc(displayCategoryName(report.category.name))}</span></div>
      <div class="detail-header"><div><div class="d-flex gap-2 mb-3">${typeBadge(report.report_type)}${statusBadge(report.status)}</div><h1>${esc(displayCategoryName(report.category.name))}</h1><p>${esc(report.colour)} item reported at ${esc(report.location.name)}</p></div><div class="detail-actions">${actions}${user && !isOwner ? `<button id="flagReport" class="btn btn-light border">${icon('flag')} Report listing</button>` : ''}</div></div>
      ${imageGallery}
      <div class="detail-layout"><article class="detail-main-card"><h2>Report description</h2><p class="description-text">${esc(report.description)}</p><div class="detail-facts"><div><span class="fact-icon">${icon('calendar')}</span><span><small>Date</small><strong>${dateOnly(report.item_date)}</strong></span></div><div><span class="fact-icon">${icon('location')}</span><span><small>Campus location</small><strong>${esc(report.location.name)}</strong></span></div><div><span class="fact-icon">${icon('file')}</span><span><small>Category</small><strong>${esc(displayCategoryName(report.category.name))}</strong></span></div><div><span class="fact-icon">${icon('info')}</span><span><small>Colour</small><strong>${esc(report.colour)}</strong></span></div></div></article>
      <aside>${report.report_type === 'FOUND' && report.status === 'OPEN' ? `<div class="claim-info-card">${icon('claim', 'safety-icon')}<h3>Think this is yours?</h3><p>${esc(report.verification_question || 'Submit a Claim with a detail that staff can use to verify ownership.')}</p>${canClaim ? `<a class="btn btn-primary w-100" href="#/reports/${report.id}/claim">Start Claim</a>` : isOwner ? '<small>This is your own report.</small>' : !claimReady ? '<small>The owner must add verification information before Claims can be submitted.</small>' : !user ? '<a class="btn btn-outline-primary w-100" href="#/login">Log in to Claim</a>' : ''}</div>` : ''}<div class="safety-card">${icon('shield', 'safety-icon')}<h3>Ownership details stay private</h3><p>Public reports never include private special features or Claim verification answers. Authorised staff review those details separately.</p></div><div class="detail-id-card"><span>Report ID</span><strong>#${report.id}</strong><small>Last updated ${dateOnly(report.updated_at)}</small></div></aside></div>`
    document.querySelector('#flagReport')?.addEventListener('click', () => openFlagDialog(report.id))
  } catch (error) { qs<HTMLElement>('#detailContent').innerHTML = errorState((error as Error).message) }
}
