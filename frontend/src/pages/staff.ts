import { getStaffClaims, recordHandover, reviewClaim } from '../api/staff'
import { currentUser } from '../api/session'
import { emptyState, errorState, loadingState, pageHeader, toast } from '../components/ui'
import { icon } from '../components/icons'
import { dateTime } from '../utils/format'
import { esc, qs, setApp } from '../utils/html'
import type { StaffClaimResponse } from '../types/api'
import { displayCategoryName } from '../utils/reference-label'

function badge(status: string): string {
  return `<span class="claim-badge claim-${status.toLowerCase()}">${esc(status)}</span>`
}

function reviewCard(claim: StaffClaimResponse): string {
  return `<article class="staff-claim-card" data-claim-id="${claim.id}">
    <div class="staff-claim-head"><div>${badge(claim.status)}<h3>Claim #${claim.id} · ${esc(displayCategoryName(claim.report.category.name))}</h3><p>Report #${claim.report.id} · claimant ${esc(claim.claimant_name)} (${esc(claim.claimant_email)})</p></div><a class="btn btn-sm btn-light border" href="#/reports/${claim.report.id}">View public report</a></div>
    <div class="staff-claim-grid">
      <div><small>Verification question</small><p>${esc(claim.report_verification_question || 'No specific question was recorded.')}</p></div>
      <div class="private-review"><small>Private report detail</small><p>${esc(claim.report_special_features || 'No private special feature was recorded.')}</p></div>
      <div><small>Claimant answer</small><p>${esc(claim.verification_answer)}</p></div>
      <div><small>Claimant message</small><p>${esc(claim.message || 'No additional message.')}</p></div>
    </div>
    <div class="workflow-meta"><span>${icon('calendar')} Submitted ${dateTime(claim.created_at)}</span><span>${icon('user')} Report owner: ${esc(claim.report_owner_email)}</span></div>
    ${claim.status === 'PENDING' ? `<div class="staff-action-panel"><div class="row g-3"><div class="col-md-6"><label class="form-label">Staff review note</label><textarea class="form-control staff-note" rows="3" placeholder="Explain the review decision."></textarea></div><div class="col-md-6"><label class="form-label">Storage note</label><textarea class="form-control storage-note" rows="3" placeholder="e.g. Security Desk locker A2"></textarea></div></div><div class="d-flex justify-content-end gap-2 mt-3"><button class="btn btn-outline-danger reject-claim">Reject</button><button class="btn btn-success approve-claim">Approve Claim</button></div></div>` : ''}
    ${claim.status === 'APPROVED' ? `<div class="staff-action-panel handover-panel"><div class="approval-summary">${icon('check')}<div><strong>Approved and waiting for handover</strong><span>${esc(claim.staff_note || 'No staff note.')}</span></div></div><label class="form-label mt-3">Handover note</label><textarea class="form-control handover-note" rows="3" placeholder="Record how identity was checked and where the item was handed over."></textarea><div class="text-end mt-3"><button class="btn btn-primary handover-claim">Record handover & mark Returned</button></div></div>` : ''}
    ${claim.status !== 'PENDING' && claim.status !== 'APPROVED' ? `<div class="staff-note mt-3"><small>Staff note</small><p>${esc(claim.staff_note || 'No staff note.')}</p></div>` : ''}
    ${claim.handed_over_at ? `<div class="handover-complete">${icon('box')} Handover recorded ${dateTime(claim.handed_over_at)}</div>` : ''}
  </article>`
}

export async function renderStaff(): Promise<void> {
  const user = currentUser()
  if (!user) { location.hash = '#/login'; return }
  if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
    setApp(`<div class="page-container">${errorState('Staff or administrator permission is required.')}</div>`); return
  }
  const params = new URLSearchParams(location.hash.split('?')[1] || '')
  const status = params.get('status') || 'PENDING'
  setApp(`<div class="page-container">${pageHeader('Staff workflow', 'Claim review and handover', 'Compare verification information, record the staff decision, and complete item handover.')}<div class="workflow-filter"><a class="${status === 'PENDING' ? 'active' : ''}" href="#/staff?status=PENDING">Pending</a><a class="${status === 'APPROVED' ? 'active' : ''}" href="#/staff?status=APPROVED">Approved</a><a class="${status === 'COMPLETED' ? 'active' : ''}" href="#/staff?status=COMPLETED">Completed</a><a class="${status === 'ALL' ? 'active' : ''}" href="#/staff?status=ALL">All</a></div><div id="staffClaims">${loadingState('Loading Claim queue…')}</div></div>`)
  try {
    const claims = await getStaffClaims(status === 'ALL' ? undefined : status)
    qs<HTMLElement>('#staffClaims').innerHTML = claims.length ? `<div class="staff-claim-list">${claims.map(reviewCard).join('')}</div>` : emptyState('No Claims in this queue', 'Change the status filter or wait for a new Claim to be submitted.')

    document.querySelectorAll<HTMLButtonElement>('.approve-claim, .reject-claim').forEach((button) => button.addEventListener('click', async () => {
      const card = button.closest<HTMLElement>('.staff-claim-card')!
      const id = Number(card.dataset.claimId)
      const note = card.querySelector<HTMLTextAreaElement>('.staff-note')?.value.trim() || null
      const storage = card.querySelector<HTMLTextAreaElement>('.storage-note')?.value.trim() || null
      const decision = button.classList.contains('approve-claim') ? 'APPROVED' : 'REJECTED'
      button.disabled = true
      try { await reviewClaim(id, decision, note, storage); toast(`Claim ${decision.toLowerCase()}.`); await renderStaff() }
      catch (error) { toast((error as Error).message, 'danger'); button.disabled = false }
    }))

    document.querySelectorAll<HTMLButtonElement>('.handover-claim').forEach((button) => button.addEventListener('click', async () => {
      const card = button.closest<HTMLElement>('.staff-claim-card')!
      const id = Number(card.dataset.claimId)
      const note = card.querySelector<HTMLTextAreaElement>('.handover-note')?.value.trim() || null
      button.disabled = true; button.textContent = 'Recording…'
      try { await recordHandover(id, note); toast('Handover recorded and report marked Returned.'); await renderStaff() }
      catch (error) { toast((error as Error).message, 'danger'); button.disabled = false; button.textContent = 'Record handover & mark Returned' }
    }))
  } catch (error) { qs<HTMLElement>('#staffClaims').innerHTML = errorState((error as Error).message) }
}
