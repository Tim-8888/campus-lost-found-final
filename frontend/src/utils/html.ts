export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!)
}

export function qs<T extends Element>(selector: string, parent: ParentNode = document): T {
  const element = parent.querySelector<T>(selector)
  if (!element) throw new Error(`Element not found: ${selector}`)
  return element
}

export function setApp(html: string): HTMLElement {
  const app = qs<HTMLElement>('#app')
  app.innerHTML = html
  app.focus({ preventScroll: true })
  window.scrollTo({ top: 0, behavior: 'auto' })
  return app
}
