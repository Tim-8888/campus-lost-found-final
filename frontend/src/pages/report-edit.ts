import { mediaUrl } from '../api/client'
import { getReferences } from '../api/references'
import { deleteReportImage, getManageReport, updateReport, uploadReportImage } from '../api/reports'
import { currentUser } from '../api/session'
import { attachReportFormInteractions, payloadFromForm, reportFormTemplate, validateReportForm } from '../components/report-form'
import { confirmDialog, errorState, loadingState, pageHeader, toast } from '../components/ui'
import { qs, setApp } from '../utils/html'

export async function renderReportEdit(id: number): Promise<void> {
  if (!currentUser()) { location.hash = '#/login'; return }
  setApp(`<div class="page-container narrow-page">${pageHeader('Manage report', 'Edit report', 'Update public details, private verification information, and report photos.')}<div id="formContent">${loadingState('Loading report…')}</div></div>`)
  try {
    const [report, refs] = await Promise.all([getManageReport(id), getReferences()])
    qs<HTMLElement>('#formContent').innerHTML = `<div id="formMessage"></div>${reportFormTemplate(refs.categories, refs.locations, report)}`
    document.querySelectorAll<HTMLImageElement>('[data-backend-image="true"]').forEach((img) => { img.src = mediaUrl(img.getAttribute('src') || '') })
    attachReportFormInteractions()
    document.querySelectorAll<HTMLButtonElement>('.remove-existing-image').forEach((button) => button.addEventListener('click', async () => {
      const imageId = Number(button.dataset.imageId); const okay = await confirmDialog('Remove this photo?', 'The image file and its database record will be deleted.', 'Remove photo'); if (!okay) return
      try { await deleteReportImage(id, imageId); button.closest('.image-manager-item')?.remove(); toast('Photo removed.') } catch (error) { toast((error as Error).message, 'danger') }
    }))

    qs<HTMLFormElement>('#reportForm').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget as HTMLFormElement; if (!validateReportForm(form)) return
      const button = qs<HTMLButtonElement>('#submitReport'); button.disabled = true; button.textContent = 'Saving…'
      try {
        await updateReport(id, payloadFromForm(form))
        const files = Array.from(qs<HTMLInputElement>('#reportImages').files || [])
        for (const file of files) await uploadReportImage(id, file)
        toast('Report changes saved.')
        location.hash = '#/my-reports'
      } catch (error) { qs<HTMLElement>('#formMessage').innerHTML = errorState((error as Error).message); window.scrollTo({ top: 0, behavior: 'smooth' }) }
      finally { button.disabled = false; button.textContent = 'Save changes' }
    })
  } catch (error) { qs<HTMLElement>('#formContent').innerHTML = errorState((error as Error).message) }
}
