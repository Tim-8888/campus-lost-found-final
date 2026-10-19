export type Role = 'STUDENT' | 'STAFF' | 'ADMIN'
export type ReportType = 'LOST' | 'FOUND'
export type ReportStatus = 'OPEN' | 'CLOSED' | 'RETURNED'
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'COMPLETED'
export type FlagReason = 'SPAM' | 'MISLEADING' | 'INAPPROPRIATE' | 'DUPLICATE' | 'OTHER'

export interface UserSummary {
  id: number
  email: string
  role: Role | string
  is_active: boolean
}

export interface ProfileResponse {
  user_id: number
  email: string
  role: string
  first_name: string
  last_name: string
  phone: string | null
  preferred_location_id: number | null
  preferred_contact_method: 'IN_APP' | 'EMAIL' | 'PHONE' | string
  notify_claim_updates: boolean
  notify_status_changes: boolean
  notify_handover: boolean
}

export interface ReferenceItem {
  id: number
  name: string
}

export interface ImageInfo {
  id: number
  url: string
  original_name: string
  mime_type: string
}

export interface ReportPublic {
  id: number
  report_type: ReportType
  category: ReferenceItem
  description: string
  item_date: string
  location: ReferenceItem
  colour: string
  verification_question?: string | null
  status: ReportStatus | string
  is_public: boolean
  images: ImageInfo[]
  created_at: string
  updated_at: string
}

export interface ReportPrivate extends ReportPublic {
  user_id: number
  special_features?: string | null
  storage_note?: string | null
}

export interface SearchResponse {
  total: number
  items: ReportPublic[]
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: UserSummary
}

export interface ReportPayload {
  report_type: ReportType
  category_id: number
  description: string
  item_date: string
  location_id: number
  colour: string
  special_features: string | null
  verification_question: string | null
  is_public: boolean
}

export interface ClaimResponse {
  id: number
  report: ReportPublic
  claimant_id: number
  status: ClaimStatus | string
  verification_answer: string
  message: string | null
  staff_note: string | null
  reviewed_at: string | null
  handed_over_at: string | null
  created_at: string
  updated_at: string
}

export interface StaffClaimResponse extends ClaimResponse {
  claimant_email: string
  claimant_name: string
  report_owner_email: string
  report_special_features: string | null
  report_verification_question: string | null
  report_storage_note: string | null
}

export interface ReceivedClaimResponse {
  id: number
  report_id: number
  report_category: string
  status: string
  created_at: string
  reviewed_at: string | null
  handed_over_at: string | null
}

export interface NotificationItem {
  id: number
  notification_type: string
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

export interface FlagResponse {
  id: number
  report_id: number
  reporter_id: number
  reason: string
  details: string | null
  status: string
  resolution_note: string | null
  created_at: string
  resolved_at: string | null
}

export interface AdminStats {
  total_users: number
  active_users: number
  lost_reports: number
  found_reports: number
  matched_reports: number
  recovered_items: number
  unresolved_cases: number
  total_claims: number
  pending_claims: number
  completed_claims: number
  open_flags: number
}

export interface AdminUser {
  id: number
  email: string
  role: string
  is_active: boolean
  first_name: string
  last_name: string
  created_at: string
}

export interface AdminReference {
  id: number
  name: string
  is_active: boolean
  report_count: number
}

export interface AdminReport {
  id: number
  owner_email: string
  report_type: string
  category: string
  location: string
  colour: string
  status: string
  is_public: boolean
  open_flags: number
  created_at: string
}

export interface SmartSearchFields {
  report_type: ReportType | null
  category_id: number | null
  category_name: string | null
  colour: string | null
  location_id: number | null
  location_name: string | null
  date_from: string | null
  date_to: string | null
  keywords: string[]
  status: ReportStatus
}

export interface SmartSearchExtractResponse {
  model: string
  fields: SmartSearchFields
  warnings: string[]
  fallback_available: boolean
}

export interface SmartSearchStatus {
  enabled: boolean
  model: string
  normal_search_available: boolean
  privacy_note: string
}
