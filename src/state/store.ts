import type { Session } from '@supabase/supabase-js';
import type {
  VolunteerRow,
  VolunteerRole,
  CampaignStatsResult,
  ReportKind,
  ReportStatus,
  MaterialCategory,
} from '../types/database';
import type { TabKey, BadgeState, HistoryState, OrgState, SlotState } from '../types/app';

export const ROLES: Record<VolunteerRole, string> = {
  ndihmes: 'Ndihmës',
  mbledhes: 'Mbledhës i autorizuar',
  koordinator: 'Koordinator',
  jurist: 'Jurist (qendra)',
  logjistike: 'Logjistikë (qendra)',
  burime_njerezore: 'BNj (qendra)',
  pr_edukim: 'PR & Edukim (qendra)',
  it: 'IT (qendra)',
  admin: 'Admin (qendra)',
};

export const QENDRA_ROLES: VolunteerRole[] = ['admin', 'jurist', 'logjistike', 'burime_njerezore', 'pr_edukim', 'it'];
export const STAFF_ROLES: VolunteerRole[] = ['koordinator', 'jurist', 'admin'];

export const ROLE_DESC: Record<Exclude<VolunteerRole, 'admin'>, string> = {
  ndihmes: 'Ndihmon në terren me mbledhjen e nënshkrimeve dhe detyra të tjera bazë.',
  mbledhes: 'I trajnuar dhe i autorizuar zyrtarisht të mbledhë nënshkrime në terren.',
  koordinator: 'Drejton një ose disa zona, organizon turnet dhe njerëzit e terrenit.',
  jurist: 'Ndihmon me pyetje ligjore dhe siguron që mbledhja të jetë brenda ligjit.',
  logjistike: 'Kujdeset për materialet, transportin dhe organizimin praktik të fushatës.',
  burime_njerezore: 'Organizon ekipet e vullnetarëve, rekrutimin dhe mirëqenien e tyre.',
  pr_edukim: 'Kujdeset për komunikimin publik dhe informimin e qytetarëve.',
  it: 'Mirëmban portalin, të dhënat dhe sistemet digjitale të fushatës.',
};

export const KINDS: Record<ReportKind, { ic: string; lb: string; d: string }> = {
  incident: { ic: '🚨', lb: 'Incident', d: 'Pengesë, presion, konflikt në terren' },
  legal: { ic: '⚖️', lb: 'Shqetësim ligjor', d: 'Pyetje ose problem me procedurën/ligjin' },
  material: { ic: '📦', lb: 'Material i humbur', d: 'Formularë, ID, fletushka të humbura/dëmtuara' },
};

export const REPORT_STATUS: Record<ReportStatus, [string, string]> = {
  open: ['Hapur', 'red'],
  review: ['Në shqyrtim', 'amber'],
  resolved: ['E zgjidhur', 'ok'],
};

export const CATS: Record<MaterialCategory, [string, string]> = {
  guide: ['📘', 'Guide-book / manuale'],
  leaflet: ['📄', 'Fletë-palosje'],
  form: ['🖊️', 'Formularë'],
  faq: ['❓', 'Pyetjet e shpeshta'],
  legal: ['⚖️', 'Dokumente ligjore'],
  other: ['📎', 'Të tjera'],
};

export class AppState {
  public ME: VolunteerRow | null = null;
  public SESSION: Session | null = null;
  public STATS: Partial<CampaignStatsResult> = {};
  public activeTab: TabKey = 'home';

  public BADGE: BadgeState = {
    priv: null,
    units: [],
    reqs: {},
  };

  public HIST: HistoryState = {
    rows: [],
    units: [],
    unit: '',
    from: '',
    to: '',
    page: 1,
    limit: 100,
    totalRows: 0,
    summary: null,
  };

  public ORG: OrgState = {
    groups: [],
    kidsOf: {},
    sel: null,
  };

  public SLOTS: Record<string, SlotState> = {};
  public SLOT_POP: string | null = null;

  public isStaff(): boolean {
    return !!this.ME && STAFF_ROLES.includes(this.ME.role);
  }

  public isAdmin(): boolean {
    return !!this.ME && this.ME.role === 'admin';
  }

  public isField(): boolean {
    return !!this.ME && ['ndihmes', 'mbledhes'].includes(this.ME.role);
  }

  public isQendra(): boolean {
    return !!this.ME && QENDRA_ROLES.includes(this.ME.role);
  }

  public isTeamLead(): boolean {
    return !!this.ME && ['koordinator', 'mbledhes'].includes(this.ME.role);
  }

  public isTeamRole(): boolean {
    return !!this.ME && ['ndihmes', 'mbledhes', 'koordinator'].includes(this.ME.role);
  }
}

export const store = new AppState();
