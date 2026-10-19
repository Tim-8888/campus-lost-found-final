import { getMyClaims, getReceivedClaims, withdrawClaim } from '../api/claims'
import { currentUser } from '../api/session'
import { confirmDialog, emptyState, errorState, loadingState, pageHeader, toast } from '../components/ui'
import { icon } from '../components/icons'
import { dateTime } from '../utils/format'
import { esc, qs, setApp } from '../utils/html'
import type { ClaimResponse, ReceivedClaimResponse } from '../types/api'
import { displayCategoryName } from '../utils/reference-label'

function claimBadge(status: string): string {
  return `<span class="claim-badge claim-${status.toLowerCase()}">${esc(status.replace('_', ' '))}</span>`
}

function submittedCard(claim: ClaimResponse): string {
  return `<article class="workflow-card"><div class="workflow-card-head"><div>${claimBadge(claim.status)}<h3>Claim #${claim.id} · ${esc(displayCategoryName(claim.report.category.name))}</h3><p>Report #${claim.report.id} · ${esc(claim.report.location.name)}</p></div><a class="btn btn-sm btn-light border" href="#/reports/${claim.report.id}">View report</a></div>
    <div class="workflow-meta"><span>${icon('calendar')} Submitted ${dateTime(claim.created_at)}</span>${claim.reviewed_at ? `<span>${icon('check')} Reviewed ${dateTime(claim.reviewed_at)}</span>` : ''}${claim.handed_over_at ? `<span>${icon('box')} Handover ${dateTime(claim.handed_over_at)}</span>` : ''}</div>
    <div class="workflow-answer"><small>Your verification answer</small><p>${esc(claim.verification_answer)}</p></div>
    ${claim.staff_note ? `<div class="staff-note"><small>Staff note</small><p>${esc(claim.staff_note)}</p></div>` : ''}
    ${claim.status === 'PENDING' ? `<div class="text-end"><button class="btn btn-sm btn-outline-danger withdraw-claim" data-id="${claim.id}">Withdraw Claim</button></div>` : ''}
  </article>`
}

function receivedCard(claim: ReceivedClaimResponse): string {
  return `<article class="workflow-card compact"><div class="workflow-card-head"><div>${claimBadge(claim.status)}<h3>Claim #${claim.id} · ${esc(claim.report_category)}</h3><p>Submitted for your report #${claim.report_id}</p></div><a class="btn btn-sm btn-light border" href="#/reports/${claim.report_id}">View report</a></div><div class="workflow-meta"><span>${icon('calendar')} ${dateTime(claim.created_at)}</span><span>${icon('shield')} Verification is handled by staff</span></div></article>`
}

export async function renderMyClaims(): Promise<void> {
  if (!currentUser()) { location.hash = '#/login'; return }
  setApp(`<div class="page-container">${pageHeader('Claims', 'My Claims', 'Track Claims you submitted and see the review status of Claims made on your Found reports.')}<div id="claimsContent">${loadingState('Loading Claims…')}</div></div>`)
  try {
    const [submitted, received] = await Promise.all([getMyClaims(), getReceivedClaims()])
    qs<HTMLElement>('#claimsContent').innerHTML = `<div class="claims-grid"><section><div class="section-heading-row"><div><h2>Submitted by me</h2><p>${submitted.length} Claim${submitted.length === 1 ? '' : 's'}</p></div></div><div class="workflow-list">${submitted.length ? submitted.map(submittedCard).join('') : emptyState('No Claims submitted', 'Open a Found report and use Claim this item when you believe it belongs to you.')}</div></section>
      <section><div class="section-heading-row"><div><h2>Claims on my Found reports</h2><p>${received.length} received</p></div></div><div class="workflow-list">${received.length ? received.map(receivedCard).join('') : emptyState('No Claims received', 'Claims submitted for your Found reports will appear here after they are created.')}</div></section></div>`
    document.querySelectorAll<HTMLButtonElement>('.withdraw-claim').forEach((button) => button.addEventListener('click', async () => {
      const ok = await confirmDialog('Withdraw this Claim?', 'Staff will no longer review this Claim.', 'Withdraw')
      if (!ok) return
      try { await withdrawClaim(Number(button.dataset.id)); toast('Claim withdrawn.'); await renderMyClaims() } catch (error) { toast((error as Error).message, 'danger') }
    }))
  } catch (error) { qs<HTMLElement>('#claimsContent').innerHTML = errorState((error as Error).message) }
}
