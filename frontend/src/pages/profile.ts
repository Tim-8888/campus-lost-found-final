import { getProfile, updateProfile } from '../api/profile'
import { getReferences } from '../api/references'
import { currentUser } from '../api/session'
import { icon } from '../components/icons'
import { errorState, loadingState, pageHeader, toast } from '../components/ui'
import { esc, qs, setApp } from '../utils/html'

export async function renderProfile(): Promise<void> {
  if (!currentUser()) { location.hash = '#/login'; return }

  setApp(`<div class="page-container">
    ${pageHeader('Account', 'Profile', 'Keep your personal details, campus preference and notification settings up to date.')}
    <div id="profileContent">${loadingState('Loading profile…')}</div>
  </div>`)

  try {
    const [profile, refs] = await Promise.all([getProfile(), getReferences()])
    const locationOptions = refs.locations
      .map((item) => `<option value="${item.id}" ${profile.preferred_location_id === item.id ? 'selected' : ''}>${esc(item.name)}</option>`)
      .join('')

    qs<HTMLElement>('#profileContent').innerHTML = `<div class="profile-layout">
      <aside class="profile-summary-card">
        <div class="profile-avatar-large">${esc(profile.first_name.charAt(0).toUpperCase())}${esc(profile.last_name.charAt(0).toUpperCase())}</div>
        <h2>${esc(profile.first_name)} ${esc(profile.last_name)}</h2>
        <p>${esc(profile.email)}</p>
        <span class="role-pill">${icon('shield')} ${esc(profile.role)}</span>
        <div class="profile-summary-note">${icon('lock')}<span>Your email and role are controlled by the account system.</span></div>
      </aside>

      <section class="form-section-card profile-form-card">
        <div class="form-section-heading"><div><h2>Personal details</h2><p>These details are used inside your account.</p></div></div>
        <div id="profileMessage"></div>
        <form id="profileForm">
          <div class="row g-3">
            <div class="col-md-6"><label class="form-label" for="profileFirst">First name</label><input class="form-control" id="profileFirst" name="first_name" value="${esc(profile.first_name)}" maxlength="100" required></div>
            <div class="col-md-6"><label class="form-label" for="profileLast">Last name</label><input class="form-control" id="profileLast" name="last_name" value="${esc(profile.last_name)}" maxlength="100" required></div>
            <div class="col-md-6"><label class="form-label" for="profilePhone">Phone</label><input class="form-control" id="profilePhone" name="phone" value="${esc(profile.phone || '')}" maxlength="50" placeholder="Optional"></div>
            <div class="col-md-6"><label class="form-label" for="profileLocation">Preferred campus location</label><select class="form-select" id="profileLocation" name="preferred_location_id"><option value="">No preference</option>${locationOptions}</select></div>
            <div class="col-md-6"><label class="form-label" for="contactMethod">Preferred contact method</label><select class="form-select" id="contactMethod" name="preferred_contact_method"><option value="IN_APP" ${profile.preferred_contact_method === 'IN_APP' ? 'selected' : ''}>In-app notification</option><option value="EMAIL" ${profile.preferred_contact_method === 'EMAIL' ? 'selected' : ''}>Email preference</option><option value="PHONE" ${profile.preferred_contact_method === 'PHONE' ? 'selected' : ''}>Phone preference</option></select><div class="form-hint"><span>The system stores this preference. Actual delivery remains in-app.</span></div></div>
          </div>

          <div class="notification-settings mt-4">
            <h3>Notification settings</h3>
            <p class="text-muted small">Choose which routine workflow updates appear in your notification list. Moderation and important account notices are always shown.</p>
            <label class="notification-setting-row"><span><strong>Claim updates</strong><small>New Claim activity and staff review decisions.</small></span><input class="form-check-input" type="checkbox" name="notify_claim_updates" ${profile.notify_claim_updates ? 'checked' : ''}></label>
            <label class="notification-setting-row"><span><strong>Report status changes</strong><small>Changes made by authorised staff or administrators.</small></span><input class="form-check-input" type="checkbox" name="notify_status_changes" ${profile.notify_status_changes ? 'checked' : ''}></label>
            <label class="notification-setting-row"><span><strong>Handover updates</strong><small>Updates when an approved Claim reaches the handover stage.</small></span><input class="form-check-input" type="checkbox" name="notify_handover" ${profile.notify_handover ? 'checked' : ''}></label>
          </div>

          <div class="d-flex justify-content-end mt-4"><button class="btn btn-primary" id="profileSubmit">Save profile</button></div>
        </form>
      </section>
    </div>`

    qs<HTMLFormElement>('#profileForm').addEventListener('submit', async (event) => {
      event.preventDefault()
      const form = event.currentTarget as HTMLFormElement
      if (!form.reportValidity()) return

      const data = new FormData(form)
      const button = qs<HTMLButtonElement>('#profileSubmit')
      button.disabled = true
      button.textContent = 'Saving…'
      try {
        await updateProfile({
          first_name: String(data.get('first_name')).trim(),
          last_name: String(data.get('last_name')).trim(),
          phone: String(data.get('phone')).trim() || null,
          preferred_location_id: data.get('preferred_location_id') ? Number(data.get('preferred_location_id')) : null,
          preferred_contact_method: String(data.get('preferred_contact_method') || 'IN_APP'),
          notify_claim_updates: (form.elements.namedItem('notify_claim_updates') as HTMLInputElement).checked,
          notify_status_changes: (form.elements.namedItem('notify_status_changes') as HTMLInputElement).checked,
          notify_handover: (form.elements.namedItem('notify_handover') as HTMLInputElement).checked,
        })
        toast('Profile saved.')
      } catch (error) {
        qs<HTMLElement>('#profileMessage').innerHTML = errorState((error as Error).message)
      } finally {
        button.disabled = false
        button.textContent = 'Save profile'
      }
    })
  } catch (error) {
    qs<HTMLElement>('#profileContent').innerHTML = errorState((error as Error).message)
  }
}
