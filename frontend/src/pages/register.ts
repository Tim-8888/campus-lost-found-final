import { register } from '../api/auth'
import { icon } from '../components/icons'
import { errorState, toast } from '../components/ui'
import { qs, setApp } from '../utils/html'

export function renderRegister(): void {
  setApp(`<div class="auth-page"><div class="auth-shell auth-shell-register">
    <section class="auth-side"><div class="auth-side-content"><div class="auth-emblem">${icon('user')}</div><span class="eyebrow light">Student account</span><h1>Create your account.</h1><p>Your account keeps your reports and private verification information connected to you.</p><div class="auth-points"><span>${icon('check')} Student role is assigned at registration</span><span>${icon('check')} Passwords are stored as secure hashes</span><span>${icon('check')} Staff and Admin accounts are not self-registered</span></div></div></section>
    <section class="auth-form-panel"><div class="auth-form-inner"><a class="back-link" href="#/">← Back to home</a><h2>Create account</h2><p class="form-intro">Enter your details to create a Student account.</p><div id="formMessage"></div><form id="registerForm" class="mt-4" novalidate><div class="row g-3"><div class="col-sm-6"><label class="form-label" for="firstName">First name</label><input class="form-control form-control-lg" id="firstName" name="first_name" maxlength="100" required></div><div class="col-sm-6"><label class="form-label" for="lastName">Last name</label><input class="form-control form-control-lg" id="lastName" name="last_name" maxlength="100" required></div><div class="col-12"><label class="form-label" for="registerEmail">Email address</label><input class="form-control form-control-lg" id="registerEmail" name="email" type="email" autocomplete="email" placeholder="name@example.com" required></div><div class="col-12"><label class="form-label" for="registerPassword">Password</label><input class="form-control form-control-lg" id="registerPassword" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required><div class="form-text">Use at least 8 characters.</div></div></div><button class="btn btn-primary btn-lg w-100 mt-4" id="registerSubmit" type="submit">Create account</button></form><p class="auth-switch">Already registered? <a href="#/login">Log in</a></p></div></section>
  </div></div>`)

  qs<HTMLFormElement>('#registerForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    if (!form.reportValidity()) return
    const button = qs<HTMLButtonElement>('#registerSubmit')
    const data = new FormData(form)
    button.disabled = true; button.textContent = 'Creating account…'
    try {
      await register({
        email: String(data.get('email')).trim(), password: String(data.get('password')),
        first_name: String(data.get('first_name')).trim(), last_name: String(data.get('last_name')).trim(),
      })
      toast('Account created. You can now log in.')
      location.hash = '#/login'
    } catch (error) {
      qs<HTMLElement>('#formMessage').innerHTML = errorState((error as Error).message)
    } finally {
      button.disabled = false; button.textContent = 'Create account'
    }
  })
}
