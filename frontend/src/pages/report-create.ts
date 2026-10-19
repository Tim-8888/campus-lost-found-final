import { createReport, uploadReportImage } from '../api/reports'
import { getReferences } from '../api/references'
import { currentUser } from '../api/session'
import { attachReportFormInteractions, payloadFromForm, reportFormTemplate, validateReportForm } from '../components/report-form'
import { errorState, loadingState, pageHeader, toast } from '../components/ui'
import { qs, setApp } from '../utils/html'

export async function renderReportCreate(): Promise<void> {
  if (!currentUser()) { location.hash = '#/login'; return }
  setApp(`<div class="page-container narrow-page">${pageHeader('Create report', 'Post a Lost or Found item', 'Add enough public detail to make the item searchable, while keeping ownership verification information private.')}<div id="formContent">${loadingState('Preparing report form…')}</div></div>`)
  try {
    const refs = await getReferences()
    qs<HTMLElement>('#formContent').innerHTML = `<div id="formMessage"></div>${reportFormTemplate(refs.categories, refs.locations)}`
    attachReportFormInteractions()

    const requestedType = new URLSearchParams(location.hash.split('?')[1] || '').get('type')
    if (requestedType === 'FOUND' || requestedType === 'LOST') qs<HTMLSelectElement>('#reportType').value = requestedType

    qs<HTMLFormElement>('#reportForm').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget as HTMLFormElement; if (!validateReportForm(form)) return
      const button = qs<HTMLButtonElement>('#submitReport'); button.disabled = true; button.textContent = 'Publishing…'
      try {
        const report = await createReport(payloadFromForm(form))
        const files = Array.from(qs<HTMLInputElement>('#reportImages').files || [])
        for (const file of files) await uploadReportImage(report.id, file)
        toast('Report published successfully.')
        location.hash = `#/reports/${report.id}`
      } catch (error) {
        qs<HTMLElement>('#formMessage').innerHTML = errorState((error as Error).message)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } finally { button.disabled = false; button.textContent = 'Publish report' }
    })
  } catch (error) { qs<HTMLElement>('#formContent').innerHTML = errorState((error as Error).message) }
}
