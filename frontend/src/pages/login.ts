import { login } from '../api/auth'
import { saveSession } from '../api/session'
import { renderLayout } from '../components/layout'
import { icon } from '../components/icons'
import { errorState } from '../components/ui'
import { qs, setApp } from '../utils/html'

export function renderLogin(): void {
  setApp(`<div class="auth-page"><div class="auth-shell">
    <section class="auth-side"><div class="auth-side-content"><div class="auth-emblem">${icon('search')}</div><span class="eyebrow light">Campus Lost &amp; Found</span><h1>Welcome back.</h1><p>Sign in to post reports, add photos, edit your information, and manage report status.</p><div class="auth-points"><span>${icon('check')} Manage your own reports</span><span>${icon('check')} Keep private verification details protected</span><span>${icon('check')} Use the same account across the system</span></div></div></section>
    <section class="auth-form-panel"><div class="auth-form-inner"><a class="back-link" href="#/">← Back to home</a><h2>Log in</h2><p class="form-intro">Log in with your registered email and password.</p><div id="formMessage"></div><form id="loginForm" class="mt-4" novalidate><div class="mb-3"><label class="form-label" for="loginEmail">Email address</label><input class="form-control form-control-lg" id="loginEmail" name="email" type="email" autocomplete="email" placeholder="name@example.com" required></div><div class="mb-2"><label class="form-label" for="loginPassword">Password</label><input class="form-control form-control-lg" id="loginPassword" name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary btn-lg w-100 mt-4" id="loginSubmit" type="submit">Log in</button></form><p class="auth-switch">No account yet? <a href="#/register">Create a student account</a></p></div></section>
  </div></div>`)

  qs<HTMLFormElement>('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    if (!form.reportValidity()) return
    const button = qs<HTMLButtonElement>('#loginSubmit')
    const data = new FormData(form)
    button.disabled = true; button.textContent = 'Signing in…'
    try {
      const result = await login({ email: String(data.get('email')), password: String(data.get('password')) })
      saveSession(result.access_token, result.user)
      renderLayout()
      location.hash = '#/'
    } catch (error) {
      qs<HTMLElement>('#formMessage').innerHTML = errorState((error as Error).message)
    } finally {
      button.disabled = false; button.textContent = 'Log in'
    }
  })
}
