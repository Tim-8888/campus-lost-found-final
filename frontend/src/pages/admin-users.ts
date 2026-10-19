import { getAdminUsers, updateAdminUser } from '../api/admin'
import { currentUser } from '../api/session'
import { errorState, loadingState, pageHeader, toast } from '../components/ui'
import { esc, qs, setApp } from '../utils/html'
import { dateTime } from '../utils/format'

export async function renderAdminUsers(): Promise<void> {
  const user = currentUser()
  if (!user) { location.hash = '#/login'; return }
  if (user.role !== 'ADMIN') { setApp(`<div class="page-container">${errorState('Administrator permission is required.')}</div>`); return }
  setApp(`<div class="page-container">${pageHeader('Administration', 'User accounts', 'Public registration creates STUDENT accounts. Review users here and assign STAFF or ADMIN roles when authorised.', '<a class="btn btn-light border" href="#/admin">Back to dashboard</a>')}<div id="userTable">${loadingState('Loading users…')}</div></div>`)
  try {
    const users = await getAdminUsers()
    qs<HTMLElement>('#userTable').innerHTML = `<div class="table-shell"><table class="table align-middle mb-0 admin-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${users.map((item) => `<tr data-user-id="${item.id}"><td><strong>${esc(`${item.first_name} ${item.last_name}`.trim() || 'Unnamed user')}</strong><small>${esc(item.email)}</small></td><td><select class="form-select form-select-sm role-select"><option value="STUDENT" ${item.role === 'STUDENT' ? 'selected' : ''}>STUDENT</option><option value="STAFF" ${item.role === 'STAFF' ? 'selected' : ''}>STAFF</option><option value="ADMIN" ${item.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option></select></td><td><select class="form-select form-select-sm active-select"><option value="true" ${item.is_active ? 'selected' : ''}>Active</option><option value="false" ${!item.is_active ? 'selected' : ''}>Inactive</option></select></td><td>${dateTime(item.created_at)}</td><td class="text-end"><button class="btn btn-sm btn-primary save-user">Save</button></td></tr>`).join('')}</tbody></table></div>`
    document.querySelectorAll<HTMLButtonElement>('.save-user').forEach((button) => button.addEventListener('click', async () => {
      const row = button.closest<HTMLTableRowElement>('tr')!
      button.disabled = true
      try {
        await updateAdminUser(Number(row.dataset.userId), {
          role: row.querySelector<HTMLSelectElement>('.role-select')!.value,
          is_active: row.querySelector<HTMLSelectElement>('.active-select')!.value === 'true',
        })
        toast('User account updated.')
      } catch (error) { toast((error as Error).message, 'danger') }
      finally { button.disabled = false }
    }))
  } catch (error) { qs<HTMLElement>('#userTable').innerHTML = errorState((error as Error).message) }
}
