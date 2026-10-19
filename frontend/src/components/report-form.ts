import type { ReferenceItem, ReportPrivate, ReportPayload } from '../types/api'
import { esc } from '../utils/html'
import { icon } from './icons'
import { displayCategoryName } from '../utils/reference-label'

function options(items: ReferenceItem[], selected?: number, category = false): string {
  return items.map((item) => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${esc(category ? displayCategoryName(item.name) : item.name)}</option>`).join('')
}

export function reportFormTemplate(categories: ReferenceItem[], locations: ReferenceItem[], existing?: ReportPrivate): string {
  return `<form id="reportForm" class="report-form" novalidate>
    <section class="form-section-card">
      <div class="form-section-heading"><div class="step-number">1</div><div><h2>Report details</h2><p>Tell people what was lost or found and where it happened.</p></div></div>
      <div class="row g-3">
        <div class="col-md-4"><label class="form-label" for="reportType">Report type <span>*</span></label><select class="form-select" id="reportType" name="report_type" required><option value="LOST" ${existing?.report_type === 'LOST' ? 'selected' : ''}>Lost item</option><option value="FOUND" ${existing?.report_type === 'FOUND' ? 'selected' : ''}>Found item</option></select><div class="form-hint"><span>Lost = you lost an item. Found = you found someone else's item.</span></div></div>
        <div class="col-md-4"><label class="form-label" for="categoryId">Category <span>*</span></label><select class="form-select" id="categoryId" name="category_id" required><option value="">Select category</option>${options(categories, existing?.category.id, true)}</select><div class="form-hint"><span>Can't find an exact match? Choose Other. The shared list is maintained by administrators.</span></div></div>
        <div class="col-md-4"><label class="form-label" for="itemDate">Date <span>*</span></label><input class="form-control" id="itemDate" name="item_date" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${esc(existing?.item_date?.slice(0, 10) || '')}" required></div>
        <div class="col-md-6"><label class="form-label" for="locationId">Campus location <span>*</span></label><select class="form-select" id="locationId" name="location_id" required><option value="">Select location</option>${options(locations, existing?.location.id)}</select><div class="form-hint"><span>Locations are shared across all reports and are maintained by administrators.</span></div></div>
        <div class="col-md-6"><label class="form-label" for="colour">Colour <span>*</span></label><input class="form-control" id="colour" name="colour" maxlength="80" value="${esc(existing?.colour || '')}" placeholder="e.g. Black, dark blue" required></div>
        <div class="col-12"><label class="form-label" for="description">Public description <span>*</span></label><textarea class="form-control" id="description" name="description" rows="5" minlength="10" maxlength="2000" placeholder="Describe the item, where you last saw it, and any public details that may help someone recognise it." required>${esc(existing?.description || '')}</textarea><div class="form-hint"><span>Visible in search results.</span><span id="descriptionCount">0 / 2000</span></div></div>
      </div>
    </section>

    <section class="form-section-card">
      <div class="form-section-heading"><div class="step-number">2</div><div><h2>Ownership verification</h2><p>Prepare a question and a private reference detail for the Claim review process.</p></div></div>
      <div class="privacy-note">${icon('lock')}<div><strong>Private reference information</strong><span>The special features are never returned by public search. Staff can compare them with a claimant's answer during review.</span></div></div>
      <div class="row g-3">
        <div class="col-12"><label class="form-label" for="verificationQuestion">Verification question <span class="found-required-mark">*</span></label><input class="form-control" id="verificationQuestion" name="verification_question" maxlength="500" value="${esc(existing?.verification_question || '')}" placeholder="e.g. What initials are written underneath the item?"><div class="form-hint"><span>Required for Found reports. This question is shown to a claimant.</span></div></div>
        <div class="col-12"><label class="form-label" for="specialFeatures">Private special features / expected detail <span class="found-required-mark">*</span></label><textarea class="form-control" id="specialFeatures" name="special_features" rows="3" maxlength="1000" placeholder="e.g. White initials CW underneath the plug">${esc(existing?.special_features || '')}</textarea><div class="form-hint"><span>Required for Found reports and never shown in public search.</span></div></div>
      </div>
    </section>

    <section class="form-section-card">
      <div class="form-section-heading"><div class="step-number">3</div><div><h2>Photos</h2><p>Add clear photos to make the report easier to recognise.</p></div></div>
      ${existing?.images?.length ? `<div class="existing-images mb-3"><div class="section-mini-title">Current photos</div><div class="image-manager-grid">${existing.images.map((img) => `<div class="image-manager-item" data-image-id="${img.id}"><img src="${esc(img.url)}" data-backend-image="true" alt="Existing report image"><button type="button" class="remove-existing-image" data-image-id="${img.id}" aria-label="Remove image">${icon('trash')}</button></div>`).join('')}</div></div>` : ''}
      <label class="upload-zone" for="reportImages"><input id="reportImages" name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><span class="upload-icon">${icon('upload')}</span><strong>Choose images</strong><span>JPEG, PNG or WebP · up to 5 MB per image</span></label>
      <div id="imagePreview" class="image-preview-grid"></div>
    </section>

    <section class="form-section-card form-section-compact">
      <div class="form-check form-switch"><input class="form-check-input" id="isPublic" type="checkbox" name="is_public" ${existing?.is_public === false ? '' : 'checked'}><label class="form-check-label" for="isPublic"><strong>Show this report in public search</strong><span>Turn this off if you need to temporarily hide the report.</span></label></div>
    </section>

    <div class="form-actions-sticky"><a class="btn btn-light border" href="${existing ? '#/my-reports' : '#/'}">Cancel</a><button class="btn btn-primary btn-lg" id="submitReport" type="submit">${existing ? 'Save changes' : 'Publish report'}</button></div>
  </form>`
}

export function validateReportForm(form: HTMLFormElement): boolean {
  const colour = form.elements.namedItem('colour') as HTMLInputElement
  const description = form.elements.namedItem('description') as HTMLTextAreaElement
  const reportType = form.elements.namedItem('report_type') as HTMLSelectElement
  const verificationQuestion = form.elements.namedItem('verification_question') as HTMLInputElement
  const specialFeatures = form.elements.namedItem('special_features') as HTMLTextAreaElement

  colour.setCustomValidity(colour.value.trim() ? '' : 'Enter the item colour.')
  description.setCustomValidity(description.value.trim().length >= 10 ? '' : 'Enter at least 10 non-space characters.')

  if (reportType.value === 'FOUND') {
    verificationQuestion.setCustomValidity(verificationQuestion.value.trim().length >= 3 ? '' : 'Enter at least 3 non-space characters for the verification question.')
    specialFeatures.setCustomValidity(specialFeatures.value.trim().length >= 3 ? '' : 'Enter at least 3 non-space characters for the private special features.')
  } else {
    verificationQuestion.setCustomValidity('')
    specialFeatures.setCustomValidity('')
  }

  return form.reportValidity()
}

export function payloadFromForm(form: HTMLFormElement): ReportPayload {
  const data = new FormData(form)
  return {
    report_type: String(data.get('report_type')) as 'LOST' | 'FOUND',
    category_id: Number(data.get('category_id')),
    description: String(data.get('description') || '').trim(),
    item_date: String(data.get('item_date') || ''),
    location_id: Number(data.get('location_id')),
    colour: String(data.get('colour') || '').trim(),
    special_features: String(data.get('special_features') || '').trim() || null,
    verification_question: String(data.get('verification_question') || '').trim() || null,
    is_public: (form.elements.namedItem('is_public') as HTMLInputElement).checked,
  }
}

export function attachReportFormInteractions(): void {
  const description = document.querySelector<HTMLTextAreaElement>('#description')
  const count = document.querySelector<HTMLElement>('#descriptionCount')
  const updateCount = () => { if (description && count) count.textContent = `${description.value.length} / 2000` }
  description?.addEventListener('input', updateCount)
  updateCount()

  const reportType = document.querySelector<HTMLSelectElement>('#reportType')
  const verificationQuestion = document.querySelector<HTMLInputElement>('#verificationQuestion')
  const specialFeatures = document.querySelector<HTMLTextAreaElement>('#specialFeatures')
  const requiredMarks = document.querySelectorAll<HTMLElement>('.found-required-mark')
  const updateVerificationRequirement = () => {
    const required = reportType?.value === 'FOUND'
    if (verificationQuestion) {
      verificationQuestion.required = required
      if (!required) verificationQuestion.setCustomValidity('')
    }
    if (specialFeatures) {
      specialFeatures.required = required
      if (!required) specialFeatures.setCustomValidity('')
    }
    requiredMarks.forEach((mark) => { mark.hidden = !required })
  }
  reportType?.addEventListener('change', updateVerificationRequirement)
  ;[description, document.querySelector<HTMLInputElement>('#colour'), verificationQuestion, specialFeatures].forEach((field) => {
    field?.addEventListener('input', () => field.setCustomValidity(''))
  })
  updateVerificationRequirement()

  const fileInput = document.querySelector<HTMLInputElement>('#reportImages')
  const preview = document.querySelector<HTMLDivElement>('#imagePreview')
  fileInput?.addEventListener('change', () => {
    if (!preview) return
    preview.innerHTML = ''
    const files = Array.from(fileInput.files || [])
    for (const file of files) {
      const url = URL.createObjectURL(file)
      const item = document.createElement('div')
      item.className = 'image-preview-item'
      item.innerHTML = `<img src="${url}" alt="Selected upload preview"><span>${esc(file.name)}</span>`
      preview.appendChild(item)
    }
  })
}
