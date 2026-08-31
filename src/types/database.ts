export type VolunteerRole =
  | 'ndihmes'
  | 'mbledhes'
  | 'koordinator'
  | 'jurist'
  | 'logjistike'
  | 'burime_njerezore'
  | 'pr_edukim'
  | 'it'
  | 'admin';

export type VolunteerStatus = 'pending' | 'approved' | 'suspended';

export type ChangeRequestKind = 'profile' | 'photo' | 'zone';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export type AnnouncementLevel = 'info' | 'important' | 'urgent';
export type AnnouncementAudience = 'all' | 'staff';

export type MaterialCategory = 'guide' | 'leaflet' | 'form' | 'faq' | 'legal' | 'other';
export type ReportKind = 'incident' | 'legal' | 'material';
export type ReportSeverity = 'low' | 'medium' | 'high';
export type ReportStatus = 'open' | 'review' | 'resolved';

export interface UnitRow {
  id: string;
  code: string;
  name: string;
  region: string | null;
  territory: string | null;
  target: number;
  coordinator_id: string | null;
  is_open: boolean;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface VolunteerRow {
  id: string;
  full_name: string;
  volunteer_code: string;
  role: VolunteerRole;
  requested_role: VolunteerRole | null;
  status: VolunteerStatus;
  unit_id: string | null;
  supervisor_id: string | null;
  city: string | null;
  photo_path: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  units?: UnitRow | null;
}

export interface VolunteerPrivateRow {
  id: string;
  phone: string | null;
  email: string | null;
  emergency_contact: string | null;
  note: string | null;
}

export interface ChangeRequestRow {
  id: string;
  volunteer_id: string;
  kind: ChangeRequestKind;
  payload: Record<string, unknown>;
  note: string | null;
  status: ChangeRequestStatus;
  reviewed_by: string | null;
  reviewed_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  pinned: boolean;
  audience: AnnouncementAudience;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

export interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  category: MaterialCategory;
  file_path: string | null;
  file_name: string | null;
  mime: string | null;
  size: number | null;
  external_url: string | null;
  uploader_name: string | null;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  kind: ReportKind;
  severity: ReportSeverity;
  title: string;
  body: string;
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  photo_path: string | null;
  status: ReportStatus;
  handled_by: string | null;
  handled_name: string | null;
  handled_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckinRow {
  id: string;
  volunteer_id: string;
  volunteer_name: string | null;
  unit_id: string | null;
  location_name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  started_at: string;
  ended_at: string | null;
  signatures: number;
  notes: string | null;
  shift_id?: string | null;
}

export interface ShiftRow {
  id: string;
  unit_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface ShiftSignupRow {
  id: string;
  shift_id: string;
  volunteer_id: string;
  volunteer_name: string | null;
  created_at: string;
}

export interface CampaignRow {
  id: number;
  title: string;
  goal: number;
  deadline: string | null;
  updated_at: string;
}

export interface SignatureTotalsRow {
  signatures: number;
  goal: number;
  updated: string | null;
}

export interface VerifiedVolunteerResult {
  valid: boolean;
  full_name?: string;
  volunteer_code?: string;
  role?: VolunteerRole;
  unit_name?: string;
  city?: string;
  photo_path?: string;
}

export interface CampaignStatsResult {
  signatures: number;
  goal: number;
  deadline: string | null;
  active_volunteers: number;
  active_collectors: number;
  open_units: number;
  open_reports: number;
  pending: number;
  pending_requests: number;
}

/** One coordinator standing over a unit, as returned by `unit_totals`. */
export interface UnitCoordinatorRef {
  id: string;
  name: string | null;
  code: string | null;
  photo: string | null;
}

export interface UnitTotalItem {
  id: string;
  code: string;
  name: string;
  region: string | null;
  territory?: string | null;
  target: number;
  is_open: boolean;
  coordinator_id: string | null;
  coordinator_name: string | null;
  coordinators?: UnitCoordinatorRef[];
  signatures: number;
  shifts?: number;
  active_now?: number;
  volunteers_count?: number;
  members?: number;
}

export interface ActiveFieldCollector {
  id: string;
  volunteer_id: string;
  volunteer_name: string;
  role: VolunteerRole;
  photo_path: string | null;
  unit_id: string | null;
  unit_code: string | null;
  unit_name: string | null;
  location_name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  started_at: string;
}

export interface MyCheckinItem {
  id: string;
  unit_id: string | null;
  unit_code: string | null;
  unit_name: string | null;
  shift_id: string | null;
  location_name: string;
  city: string | null;
  started_at: string;
  ended_at: string | null;
  signatures: number;
  credited: number;
  team_size: number;
  i_am_lead: boolean;
  notes: string | null;
}

export interface ShiftListItem {
  id: string;
  unit_id: string;
  unit_code: string;
  unit_name: string;
  unit_is_open: boolean;
  starts_at: string;
  ends_at: string;
  capacity: number;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  closed_at: string | null;
  signed_count: number;
  checked_in_count: number;
  signatures?: number;
  i_am_in: boolean;
  i_am_lead: boolean;
  signed: Array<{ id: string; name: string; role: VolunteerRole; photo: string | null }>;
}

export interface HistoryRowItem {
  id: string;
  unit_id: string | null;
  unit_code: string | null;
  unit_name: string | null;
  volunteer_id: string;
  volunteer_name: string;
  location_name: string;
  city: string | null;
  started_at: string;
  ended_at: string | null;
  signatures: number;
  notes: string | null;
  shift_id: string | null;
  is_lead: boolean;
}

export interface HistorySummaryResult {
  total_signatures: number;
  total_shifts: number;
  open_shifts: number;
  active_units: number;
}
