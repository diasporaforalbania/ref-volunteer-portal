import type {
  VolunteerRow,
  VolunteerPrivateRow,
  UnitRow,
  UnitTotalItem,
  VolunteerRole,
  ChangeRequestRow,
} from './database';

export type TabKey =
  | 'home'
  | 'shifts'
  | 'field'
  | 'history'
  | 'materials'
  | 'news'
  | 'reports'
  | 'badge'
  | 'panel'
  | 'admin'
  | 'feedback';

export interface BadgeState {
  priv: VolunteerPrivateRow | null;
  units: UnitRow[];
  reqs: Record<string, ChangeRequestRow>;
}

export interface HistoryState {
  rows: any[];
  units: UnitTotalItem[];
  unit: string;
  from: string;
  to: string;
  page: number;
  limit: number;
  totalRows: number;
  summary: {
    total_signatures?: number;
    total_shifts?: number;
    open_shifts?: number;
    active_units?: number;
    total_hours?: number;
  } | null;
}

export interface SlotParticipant {
  id?: string;
  name?: string;
  role?: VolunteerRole | string;
  photo?: string | null;
}

export interface SlotState {
  signed: SlotParticipant[];
  capacity: number;
  label: string | null;
}

export interface OrgGroup {
  id: string;
  label: string;
  roots: VolunteerRow[];
}

export interface OrgState {
  groups: OrgGroup[];
  kidsOf: Record<string, VolunteerRow[]>;
  sel: string | null;
}

export interface SlippyMapPin {
  id?: string;
  lat: number;
  lng: number;
  volunteer_name?: string | null;
  role?: string | null;
  unit_code?: string | null;
  unit_name?: string | null;
  location_name?: string | null;
  city?: string | null;
  photo_path?: string | null;
  started_at?: string | null;
}

export interface SlippyMapState {
  el: HTMLElement;
  pins: SlippyMapPin[];
  z: number;
  cx: number;
  cy: number;
  open: string | null;
  off?: () => void;
}
