import { renderHome } from './pages/home'
import { renderLogin } from './pages/login'
import { renderRegister } from './pages/register'
import { renderProfile } from './pages/profile'
import { renderSearch } from './pages/search'
import { renderSmartSearch } from './pages/smart-search'
import { renderReportCreate } from './pages/report-create'
import { renderReportEdit } from './pages/report-edit'
import { renderReportDetail } from './pages/report-detail'
import { renderMyReports } from './pages/my-reports'
import { renderClaimCreate } from './pages/claim-create'
import { renderMyClaims } from './pages/my-claims'
import { renderNotifications } from './pages/notifications'
import { renderStaff } from './pages/staff'
import { renderAdminDashboard } from './pages/admin-dashboard'
import { renderAdminUsers } from './pages/admin-users'
import { renderAdminReferences } from './pages/admin-references'
import { renderAdminReports } from './pages/admin-reports'
import { renderAdminFlags } from './pages/admin-flags'
import { renderNotFound } from './pages/not-found'
import { renderLayout } from './components/layout'

export async function route(): Promise<void> {
  renderLayout()
  const raw = location.hash.replace(/^#\/?/, '').split('?')[0]
  const parts = raw.split('/').filter(Boolean)
  if (!parts.length) return renderHome()
  if (parts[0] === 'login') return renderLogin()
  if (parts[0] === 'register') return renderRegister()
  if (parts[0] === 'profile') return renderProfile()
  if (parts[0] === 'smart-search') return renderSmartSearch()
  if (parts[0] === 'my-reports') return renderMyReports()
  if (parts[0] === 'my-claims') return renderMyClaims()
  if (parts[0] === 'notifications') return renderNotifications()
  if (parts[0] === 'staff') return renderStaff()
  if (parts[0] === 'admin' && parts.length === 1) return renderAdminDashboard()
  if (parts[0] === 'admin' && parts[1] === 'users') return renderAdminUsers()
  if (parts[0] === 'admin' && parts[1] === 'references') return renderAdminReferences()
  if (parts[0] === 'admin' && parts[1] === 'reports') return renderAdminReports()
  if (parts[0] === 'admin' && parts[1] === 'flags') return renderAdminFlags()
  if (parts[0] === 'reports' && parts[1] === 'new') return renderReportCreate()
  if (parts[0] === 'reports' && parts[1] === 'edit' && /^\d+$/.test(parts[2] || '')) return renderReportEdit(Number(parts[2]))
  if (parts[0] === 'reports' && /^\d+$/.test(parts[1] || '') && parts[2] === 'claim') return renderClaimCreate(Number(parts[1]))
  if (parts[0] === 'reports' && /^\d+$/.test(parts[1] || '')) return renderReportDetail(Number(parts[1]))
  if (parts[0] === 'reports') return renderSearch()
  return renderNotFound()
}
