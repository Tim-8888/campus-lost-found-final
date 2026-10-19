import { icon } from '../components/icons'
import { setApp } from '../utils/html'

export function renderNotFound(): void {
  setApp(`<div class="not-found-page"><div class="not-found-icon">${icon('search')}</div><span>404</span><h1>Page not found</h1><p>The page you requested could not be found.</p><a class="btn btn-primary" href="#/">Return home</a></div>`)
}
