import { currentUser, clearSession } from '../api/session'
import { getUnreadNotificationCount } from '../api/notifications'
import { icon } from './icons'
import { esc } from '../utils/html'

function active(path: string): string {
  const hash = location.hash || '#/'
  if (path === '#/' && (hash === '#/' || hash === '#')) return 'active'
  if (path !== '#/' && hash.startsWith(path)) return 'active'
  return ''
}

export function renderLayout(): void {
  const user = currentUser()
  const isStaff = user?.role === 'STAFF' || user?.role === 'ADMIN'
  const isAdmin = user?.role === 'ADMIN'
  const header = document.querySelector<HTMLDivElement>('#site-header')!
  header.innerHTML = `<nav class="navbar navbar-expand-lg app-navbar sticky-top" aria-label="Main navigation">
    <div class="container app-container">
      <a class="navbar-brand brand-lockup" href="#/" aria-label="Campus Lost and Found home">
        <span class="brand-mark">${icon('search', 'brand-icon')}</span>
        <span><strong>Campus</strong><small>Lost &amp; Found</small></span>
      </a>
      <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">${icon('menu', 'icon-lg')}</button>
      <div class="collapse navbar-collapse" id="mainNav">
        <div class="navbar-nav mx-lg-auto nav-main">
          <a class="nav-link ${active('#/reports')}" href="#/reports">${icon('search')} Search</a><a class="nav-link ${active('#/smart-search')}" href="#/smart-search">${icon('sparkles')} Smart Search</a>
          ${user ? `<a class="nav-link ${active('#/my-reports')}" href="#/my-reports">${icon('file')} My Reports</a><a class="nav-link ${active('#/my-claims')}" href="#/my-claims">${icon('claim')} My Claims</a>` : ''}
          ${isStaff ? `<a class="nav-link ${active('#/staff')}" href="#/staff">${icon('clipboard')} Staff Review</a>` : ''}
          ${isAdmin ? `<a class="nav-link ${active('#/admin')}" href="#/admin">${icon('chart')} Admin</a>` : ''}
        </div>
        <div class="nav-actions mt-3 mt-lg-0">
          ${user ? `<a class="notification-link ${active('#/notifications')}" href="#/notifications" aria-label="Notifications">${icon('bell')}<span id="notificationBadge" class="notification-badge d-none">0</span></a>
            <a class="btn btn-primary btn-sm px-3" href="#/reports/new">${icon('plus')} Report item</a>
            <div class="dropdown">
              <button class="user-menu" data-bs-toggle="dropdown" aria-expanded="false"><span class="user-avatar">${esc(user.email.charAt(0).toUpperCase())}</span><span class="d-none d-xl-block"><strong>${esc(user.email)}</strong><small>${esc(user.role)}</small></span></button>
              <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
                <li><a class="dropdown-item" href="#/profile">${icon('user')} Profile</a></li>
                <li><a class="dropdown-item" href="#/my-reports">${icon('file')} My Reports</a></li>
                <li><a class="dropdown-item" href="#/my-claims">${icon('claim')} My Claims</a></li>
                <li><a class="dropdown-item" href="#/notifications">${icon('bell')} Notifications</a></li>
                ${isStaff ? `<li><a class="dropdown-item" href="#/staff">${icon('clipboard')} Staff Review</a></li>` : ''}
                ${isAdmin ? `<li><a class="dropdown-item" href="#/admin">${icon('chart')} Administrator</a></li>` : ''}
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item text-danger" id="logoutButton">${icon('logout')} Log out</button></li>
              </ul>
            </div>` : `<a class="btn btn-link nav-login" href="#/login">Log in</a><a class="btn btn-primary btn-sm px-3" href="#/register">Create account</a>`}
        </div>
      </div>
    </div>
  </nav>`

  const footer = document.querySelector<HTMLDivElement>('#site-footer')!
  footer.innerHTML = `<footer class="app-footer"><div class="container app-container"><div><strong>Campus Lost &amp; Found</strong><p>Complete system for reporting, Normal Search, Smart Search, Claims, staff review, notifications and administration.</p></div><div class="footer-links"><a href="#/reports">Normal Search</a><a href="#/smart-search">Smart Search</a><a href="#/reports/new">Post a report</a>${user ? `<a href="#/my-claims">My Claims</a>` : ''}</div></div></footer>`

  document.querySelector('#logoutButton')?.addEventListener('click', () => {
    clearSession()
    location.hash = '#/'
    renderLayout()
  })

  if (user) {
    void getUnreadNotificationCount().then(({ unread }) => {
      const badge = document.querySelector<HTMLElement>('#notificationBadge')
      if (!badge) return
      badge.textContent = unread > 99 ? '99+' : String(unread)
      badge.classList.toggle('d-none', unread === 0)
    }).catch(() => undefined)
  }
}
