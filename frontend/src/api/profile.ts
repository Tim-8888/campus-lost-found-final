import { api } from './client'
import type { ProfileResponse } from '../types/api'

export type ProfileUpdatePayload = Partial<Pick<
  ProfileResponse,
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'preferred_location_id'
  | 'preferred_contact_method'
  | 'notify_claim_updates'
  | 'notify_status_changes'
  | 'notify_handover'
>>

export function getProfile() {
  return api<ProfileResponse>('/profiles/me')
}

export function updateProfile(payload: ProfileUpdatePayload) {
  return api<ProfileResponse>('/profiles/me', { method: 'PATCH', body: JSON.stringify(payload) })
}
