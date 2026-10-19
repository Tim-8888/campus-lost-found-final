export function dateOnly(value: string): string {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function timeAgo(value: string): string {
  const timestamp = new Date(value).getTime()
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return dateOnly(value)
}

export function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|\s)\w/g, (m) => m.toUpperCase())
}

export function dateTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(date)
}
