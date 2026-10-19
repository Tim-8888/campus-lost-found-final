import { getReport } from '../api/reports'
import { submitClaim } from '../api/claims'
import { currentUser } from '../api/session'
import { errorState, loadingState, pageHeader, toast, typeBadge, statusBadge } from '../components/ui'
import { icon } from '../components/icons'
import { esc, qs, setApp } from '../utils/html'
import { displayCategoryName } from '../utils/reference-label'

export async function renderClaimCreate(reportId: number): Promise<void> {
  const user = currentUser()
  if (!user) { location.hash = '#/login'; return }
  if (user.role !== 'STUDENT') { setApp(`<div class="page-container">${errorState('Only Student accounts can submit Claims.')}</div>`); return }
  setApp(`<div class="page-container narrow-page">${pageHeader('Claim item', 'Submit a Claim', 'Provide verification information for staff review. Your answer is not shown in public search.')}<div id="claimContent">${loadingState('Loading report…')}</div></div>`)
  try {
    const report = await getReport(reportId)
    if (report.report_type !== 'FOUND' || report.status !== 'OPEN') {
      qs<HTMLElement>('#claimContent').innerHTML = errorState('This report is not currently open for Claims.')
      return
    }
    const question = report.verification_question || 'Describe a private detail that can help staff verify ownership.'
    qs<HTMLElement>('#claimContent').innerHTML = `<div class="claim-report-summary"><div>${typeBadge(report.report_type)} ${statusBadge(report.status)}<h2>${esc(displayCategoryName(report.category.name))}</h2><p>${esc(report.description)}</p><small>${icon('location')} ${esc(report.location.name)} · ${esc(report.colour)}</small></div><a class="btn btn-light border" href="#/reports/${report.id}">View report</a></div>
      <form id="claimForm" class="form-section-card mt-3">
        <div class="form-section-heading"><div class="step-number">1</div><div><h2>Verification answer</h2><p>Staff will compare this response with the private information recorded by the person who found the item.</p></div></div>
        <div class="verification-question-box">${icon('shield')}<div><small>Verification question</small><strong>${esc(question)}</strong></div></div>
        <label class="form-label mt-3" for="claimAnswer">Your answer <span>*</span></label>
        <textarea class="form-control" id="claimAnswer" rows="5" minlength="3" maxlength="1500" required placeholder="Give a specific answer. Do not include passwords or unrelated personal information."></textarea>
        <label class="form-label mt-3" for="claimMessage">Additional message</label>
        <textarea class="form-control" id="claimMessage" rows="3" maxlength="1000" placeholder="Optional context for staff."></textarea>
        <div class="privacy-note mt-3">${icon('lock')}<div><strong>Private Claim information</strong><span>Your verification answer is available to authorised staff for review and is not included in public report data.</span></div></div>
        <div class="d-flex justify-content-end gap-2 mt-4"><a class="btn btn-light border" href="#/reports/${report.id}">Cancel</a><button id="submitClaim" class="btn btn-primary" type="submit">Submit Claim</button></div>
      </form>`

    qs<HTMLFormElement>('#claimForm').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.currentTarget as HTMLFormElement
      if (!form.reportValidity()) return
      const button = qs<HTMLButtonElement>('#submitClaim')
      button.disabled = true; button.textContent = 'Submitting…'
      try {
        await submitClaim(reportId, qs<HTMLTextAreaElement>('#claimAnswer').value.trim(), qs<HTMLTextAreaElement>('#claimMessage').value.trim() || null)
        toast('Claim submitted for staff review.')
        location.hash = '#/my-claims'
      } catch (error) {
        toast((error as Error).message, 'danger')
        button.disabled = false; button.textContent = 'Submit Claim'
      }
    })
  } catch (error) {
    qs<HTMLElement>('#claimContent').innerHTML = errorState((error as Error).message)
  }
}
