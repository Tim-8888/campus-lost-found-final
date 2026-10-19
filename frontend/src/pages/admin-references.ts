import { createAdminCategory, createAdminLocation, getAdminCategories, getAdminLocations, updateAdminCategory, updateAdminLocation } from '../api/admin'
import { currentUser } from '../api/session'
import { confirmDialog, errorState, loadingState, pageHeader, toast } from '../components/ui'
import { icon } from '../components/icons'
import { esc, qs, setApp } from '../utils/html'
import type { AdminReference } from '../types/api'

function listTemplate(kind: 'category' | 'location', items: AdminReference[]): string {
  return `<div class="reference-list">${items.map((item) => `<div class="reference-row" data-id="${item.id}" data-kind="${kind}" data-active="${String(item.is_active)}"><input class="form-control form-control-sm ref-name" value="${esc(item.name)}"><span class="reference-count">${item.report_count} report${item.report_count === 1 ? '' : 's'}</span><span class="badge ${item.is_active ? 'text-bg-success' : 'text-bg-secondary'}">${item.is_active ? 'Active' : 'Removed'}</span><button class="btn btn-sm btn-light border save-ref">Save name</button><button class="btn btn-sm ${item.is_active ? 'btn-outline-danger' : 'btn-outline-success'} toggle-ref">${item.is_active ? 'Remove from list' : 'Restore'}</button></div>`).join('')}</div>`
}

export async function renderAdminReferences(): Promise<void> {
  const user = currentUser()
  if (!user) { location.hash = '#/login'; return }
  if (user.role !== 'ADMIN') { setApp(`<div class="page-container">${errorState('Administrator permission is required.')}</div>`); return }
  setApp(`<div class="page-container">${pageHeader('Administration', 'Categories and locations', 'Add, rename, remove or restore the shared reference data used by Report forms, Profile, Search and Smart Search.', '<a class="btn btn-light border" href="#/admin">Back to dashboard</a>')}<div class="alert alert-light border mb-4"><strong>System-wide reference data</strong><br>Only administrators can change these shared lists. Removing an item hides it from new forms and filters but keeps old reports valid.</div><div id="referenceContent">${loadingState('Loading reference data…')}</div></div>` )
  try {
    const [categories, locations] = await Promise.all([getAdminCategories(), getAdminLocations()])
    qs<HTMLElement>('#referenceContent').innerHTML = `<div class="admin-two-column"><section class="admin-panel"><div class="admin-panel-head"><div><h2>Categories</h2><p>Item types used across the system.</p></div></div><form id="newCategory" class="reference-add"><input class="form-control" name="name" placeholder="New category name" required><button class="btn btn-primary" type="submit">${icon('plus')} Add</button></form>${listTemplate('category', categories)}</section><section class="admin-panel"><div class="admin-panel-head"><div><h2>Locations</h2><p>Campus places available in forms and filters.</p></div></div><form id="newLocation" class="reference-add"><input class="form-control" name="name" placeholder="New location name" required><button class="btn btn-primary" type="submit">${icon('plus')} Add</button></form>${listTemplate('location', locations)}</section></div>`

    qs<HTMLFormElement>('#newCategory').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const name = String(new FormData(form).get('name') || '').trim(); if (!name) return
      try { await createAdminCategory(name); toast('Category added.'); await renderAdminReferences() } catch (error) { toast((error as Error).message, 'danger') }
    })
    qs<HTMLFormElement>('#newLocation').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const name = String(new FormData(form).get('name') || '').trim(); if (!name) return
      try { await createAdminLocation(name); toast('Location added.'); await renderAdminReferences() } catch (error) { toast((error as Error).message, 'danger') }
    })
    document.querySelectorAll<HTMLButtonElement>('.save-ref').forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest<HTMLElement>('.reference-row')!; const id = Number(row.dataset.id); const name = row.querySelector<HTMLInputElement>('.ref-name')!.value.trim()
      if (!name) { toast('Name cannot be empty.', 'danger'); return }
      button.disabled = true
      try { row.dataset.kind === 'category' ? await updateAdminCategory(id, { name }) : await updateAdminLocation(id, { name }); toast('Name updated.'); await renderAdminReferences() }
      catch (error) { toast((error as Error).message, 'danger') }
      finally { button.disabled = false }
    }))
    document.querySelectorAll<HTMLButtonElement>('.toggle-ref').forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest<HTMLElement>('.reference-row')!; const id = Number(row.dataset.id); const isActive = row.dataset.active === 'true'; const kind = row.dataset.kind as 'category' | 'location'; const label = kind === 'category' ? 'category' : 'location'
      if (isActive) {
        const count = Number(row.querySelector<HTMLElement>('.reference-count')?.textContent?.match(/\d+/)?.[0] || 0)
        const message = count > 0 ? `This ${label} is used by ${count} report${count === 1 ? '' : 's'}. Existing reports will keep it, but it will disappear from new forms and filters.` : `This ${label} will disappear from new forms and filters. It can be restored later.`
        const okay = await confirmDialog(`Remove this ${label} from the active list?`, message, 'Remove from list')
        if (!okay) return
      }
      button.disabled = true
      try {
        const payload = { is_active: !isActive }
        kind === 'category' ? await updateAdminCategory(id, payload) : await updateAdminLocation(id, payload)
        toast(isActive ? `${label[0].toUpperCase() + label.slice(1)} removed from the active list.` : `${label[0].toUpperCase() + label.slice(1)} restored.`)
        await renderAdminReferences()
      } catch (error) { toast((error as Error).message, 'danger') }
      finally { button.disabled = false }
    }))
  } catch (error) { qs<HTMLElement>('#referenceContent').innerHTML = errorState((error as Error).message) }
}
