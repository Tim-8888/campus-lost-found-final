import { api } from './client'
import type { ReferenceItem } from '../types/api'

export async function getReferences() {
  const [categories, locations] = await Promise.all([
    api<ReferenceItem[]>('/references/categories'),
    api<ReferenceItem[]>('/references/locations'),
  ])
  return { categories, locations }
}
