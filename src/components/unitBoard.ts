import { sb } from '../api/client';
import { store } from '../state/store';
import { esc, truncate } from '../utils/security';
import { nf } from '../utils/format';
import { avatarHtml } from '../api/storage';
import { fail } from './toast';
import { attachDnd } from '../utils/dnd';
import type { UnitTotalItem, VolunteerRole, VolunteerRow } from '../types/database';

// The unit board: every unit is a plaque you place people around. Coordinators
// stand above it, authorized collectors below it, helpers under a collector.
// The rules are enforced again in the RPCs — this is the fast half, not the
// only one, so a rejected write always wins over what the board shows.

interface BoardPerson {
  id: string;
  name: string;
  code: string;
  role: VolunteerRole;
  photo: string | null;
}

type ZoneKind = 'coord' | 'collect' | 'help' | 'pool';

const ROLE_CLASS: Record<string, string> = {
  koordinator: 'r-coord',
  mbledhes: 'r-collect',
  ndihmes: 'r-help',
};

let detach: (() => void) | null = null;

export function unitBoardHtml(): string {
  return `
    <div class="board-bar">
      <div class="board-hint" id="board_hint"></div>
      <div class="board-log" id="board_log" role="status" aria-live="polite"></div>
    </div>
    <div class="board" id="board_grid"></div>`;
}

export function renderUnitBoard(rootId: string, units: UnitTotalItem[], team: VolunteerRow[]): void {
  const root = document.getElementById(rootId);
  const me = store.ME;
  if (!root || !me) return;

  detach?.();
  root.innerHTML = unitBoardHtml();

  const grid = document.getElementById('board_grid');
  if (!grid) return;

  // ---- model ---------------------------------------------------------------
  const people = new Map<string, BoardPerson>();
  const coordOf = new Map<string, string[]>(); // unit id  → coordinator ids
  const unitOf = new Map<string, string>();    // collector → unit id
  const supOf = new Map<string, string>();     // helper    → collector id

  units.forEach(u => {
    const ids: string[] = [];
    (u.coordinators || []).forEach(c => {
      if (!people.has(c.id)) {
        people.set(c.id, {
          id: c.id,
          name: c.name || c.code || 'Koordinator',
          code: c.code || '',
          role: 'koordinator',
          photo: c.photo,
        });
      }
      ids.push(c.id);
    });
    coordOf.set(u.id, ids);
  });

  team.forEach(v => {
    people.set(v.id, {
      id: v.id,
      name: v.full_name || v.volunteer_code,
      code: v.volunteer_code,
      role: v.role,
      photo: v.photo_path,
    });
    if (v.role === 'mbledhes' && v.unit_id) unitOf.set(v.id, v.unit_id);
    if (v.role === 'ndihmes' && v.supervisor_id) supOf.set(v.id, v.supervisor_id);
  });

  const unitById = new Map(units.map(u => [u.id, u]));
  const isOpen = (unitId: string | null | undefined): boolean => !!unitId && !!unitById.get(unitId)?.is_open;
  const unitCode = (unitId: string): string => unitById.get(unitId)?.code || 'njësia';

  // ---- who may drag what ---------------------------------------------------
  const meId = me.id;
  const isAdm = store.isAdmin();
  const isCoord = me.role === 'koordinator';
  const isCollector = me.role === 'mbledhes';
  const myUnits = new Set(units.filter(u => (coordOf.get(u.id) || []).includes(meId)).map(u => u.id));
  const canStaff = (unitId: string | null | undefined): boolean =>
    isAdm || (isCoord && !!unitId && myUnits.has(unitId));
  const interactive = isAdm || isCoord || isCollector;

  /** May I take this person out of where they currently are? */
  function originAllowed(p: BoardPerson): boolean {
    if (isAdm) return true;
    if (p.role === 'koordinator') return false; // only the centre moves coordinators
    if (p.role === 'mbledhes') {
      const u = unitOf.get(p.id);
      return u ? canStaff(u) : isCoord;
    }
    const sup = supOf.get(p.id);
    if (!sup) return isCoord || isCollector;
    if (sup === meId) return true;
    return canStaff(unitOf.get(sup));
  }

  /** May I put someone into this slot? */
  function destAllowed(kind: ZoneKind, key: string): boolean {
    if (isAdm) return true;
    if (kind === 'pool') return true; // removal is governed by the origin
    if (kind === 'coord') return false;
    if (kind === 'collect') return canStaff(key);
    return key === meId || canStaff(unitOf.get(key));
  }

  function eligible(p: BoardPerson, kind: ZoneKind, key: string, from: string): boolean {
    if (!interactive || !originAllowed(p) || !destAllowed(kind, key)) return false;
    if (kind === 'pool') return from !== 'pool';
    if (kind === 'coord') return p.role === 'koordinator' && isOpen(key);
    if (kind === 'collect') return p.role === 'mbledhes' && isOpen(key);
    if (kind === 'help') return p.role === 'ndihmes' && isOpen(unitOf.get(key));
    return false;
  }

  const draggable = (p: BoardPerson): boolean => interactive && originAllowed(p);

  // ---- markup --------------------------------------------------------------
  function marble(id: string, from: string, owner?: string, tag?: string): string {
    const p = people.get(id);
    if (!p) return '';
    const cls = `marble ${ROLE_CLASS[p.role] || ''}${p.id === meId ? ' me' : ''}`;
    const body =
      `${avatarHtml(p.photo, p.name, 'mb-av')}` +
      `<span class="mb-nm">${esc(truncate(p.name, 22))}</span>` +
      (tag ? `<span class="mb-tag">${esc(tag)}</span>` : '');
    const data = `data-vol="${esc(id)}" data-from="${esc(from)}"${owner ? ` data-owner="${esc(owner)}"` : ''}`;

    return draggable(p)
      ? `<button type="button" class="${cls}" data-marble ${data} title="${esc(p.name)}">${body}</button>`
      : `<div class="${cls} static" ${data} title="${esc(p.name)}">${body}</div>`;
  }

  function zone(kind: ZoneKind, key: string, label: string, inner: string, extra = ''): string {
    const pos = kind === 'coord' ? ' top' : kind === 'collect' ? ' bottom' : '';
    return `<div class="zone${pos}${extra}" data-zone="${kind}" data-key="${esc(key)}"${
      interactive ? ' tabindex="0"' : ''
    } aria-label="${esc(label)}">
      <span class="zone-lb">${esc(label)}</span>${inner}</div>`;
  }

  function render(): void {
    // rail — everyone still waiting for a place. Coordinators always stay here:
    // they may hold several units, so the rail is where you pick one up again.
    const railGroups: Array<[string, string, string]> = [];

    const coords = [...people.values()].filter(p => p.role === 'koordinator');
    railGroups.push(['Koordinatorë', 'r-coord', coords.map(p => {
      const held = units.filter(u => (coordOf.get(u.id) || []).includes(p.id)).length;
      return marble(p.id, 'pool', undefined, held ? `${held} njësi` : undefined);
    }).join('')]);

    const freeCollectors = [...people.values()].filter(p => p.role === 'mbledhes' && !unitOf.has(p.id));
    railGroups.push(['Mbledhës të autorizuar', 'r-collect',
      freeCollectors.map(p => marble(p.id, 'pool')).join('')]);

    const freeHelpers = [...people.values()].filter(p => p.role === 'ndihmes' && !supOf.has(p.id));
    railGroups.push(['Ndihmës', 'r-help', freeHelpers.map(p => marble(p.id, 'pool')).join('')]);

    const rail = `
      <aside class="rail" data-zone="pool" data-key=""${interactive ? ' tabindex="0"' : ''}
             aria-label="Vullnetarë pa vend">
        <div class="rail-hd">Vullnetarët${
          interactive ? '<span>Lëshojini këtu për t’i liruar</span>' : ''
        }</div>
        ${railGroups.map(([label, cls, body]) => `
          <div class="rail-grp ${cls}">
            <div class="rail-lb">${esc(label)}</div>
            <div class="rail-list">${body || '<div class="rail-void">Askush në pritje</div>'}</div>
          </div>`).join('')}
      </aside>`;

    // Admins arrange the whole campaign, so they get every unit including the
    // empty ones. Everyone else sees only units they can act on or belong to —
    // otherwise a helper would scroll past dozens of blank plaques.
    const shown = units.filter(u =>
      isAdm
      || myUnits.has(u.id)
      || u.id === me?.unit_id
      || (coordOf.get(u.id) || []).length > 0
      || [...unitOf.values()].includes(u.id));

    // units — open first, closed greyed at the end so history stays readable
    const ordered = [...shown].sort((a, b) =>
      Number(b.is_open) - Number(a.is_open) || a.code.localeCompare(b.code));

    const cards = ordered.map(u => {
      const shut = !u.is_open;

      const coordList = (coordOf.get(u.id) || []).map(id => marble(id, 'coord', u.id)).join('');
      const collectors = [...unitOf.entries()].filter(([, unitId]) => unitId === u.id).map(([cid]) => {
        const helpers = [...supOf.entries()]
          .filter(([, sid]) => sid === cid)
          .map(([hid]) => marble(hid, 'help', cid))
          .join('');
        return `<div class="collector">${marble(cid, 'collect', u.id)}
          <div class="nest">${zone('help', cid, 'Ndihmësit',
            helpers || `<div class="zone-void">${shut ? '—' : 'Ndihmës…'}</div>`)}</div>
        </div>`;
      }).join('');

      const pc = u.target > 0 ? Math.min(100, Math.round((u.signatures / u.target) * 100)) : 0;

      return `<div class="unit${shut ? ' shut' : ''}">
        ${zone('coord', u.id, 'Koordinatorët',
          coordList || `<div class="zone-void">${shut ? '—' : 'Lësho një koordinator këtu'}</div>`)}
        <div class="plaque">
          <div class="plaque-top">
            <span class="ucode">${esc(u.code)}</span>
            <span class="pill ${u.is_open ? 'ok' : 'gray'}">${u.is_open ? 'hapur' : 'mbyllur'}</span>
          </div>
          <div class="uname">${esc(u.name)}</div>
          <div class="bar" style="margin:8px 0 0"><span style="width:${pc}%"></span></div>
          <div class="ufigs"><span>${nf(u.signatures)} firma</span><span>${pc}% e ${nf(u.target)}</span></div>
        </div>
        ${zone('collect', u.id, 'Mbledhësit e autorizuar',
          collectors || `<div class="zone-void">${shut ? '—' : 'Lësho një mbledhës këtu'}</div>`)}
      </div>`;
    }).join('');

    grid!.innerHTML = `${rail}<div class="units">${
      cards || '<div class="empty">Ende pa njësi organizative.</div>'
    }</div>`;
  }

  // ---- status line ---------------------------------------------------------
  const logEl = document.getElementById('board_log');
  const hintEl = document.getElementById('board_hint');

  if (hintEl) {
    hintEl.textContent = interactive
      ? 'Tërhiqni një vullnetar, ose prekeni dhe më pas prekni vendin. Kthejeni te lista majtas për ta liruar.'
      : 'Struktura e ekipit tuaj. Vetëm qendra dhe koordinatorët i ndryshojnë vendet.';
  }
  function say(text: string, kind: 'ok' | 'no' | 'idle' = 'idle'): void {
    if (logEl) {
      logEl.className = `board-log ${kind}`;
      logEl.textContent = text;
    }
  }

  // ---- writes --------------------------------------------------------------
  function snapshot() {
    return {
      coordOf: new Map([...coordOf].map(([k, v]) => [k, [...v]])),
      unitOf: new Map(unitOf),
      supOf: new Map(supOf),
    };
  }
  function restore(s: ReturnType<typeof snapshot>): void {
    coordOf.clear(); s.coordOf.forEach((v, k) => coordOf.set(k, v));
    unitOf.clear(); s.unitOf.forEach((v, k) => unitOf.set(k, v));
    supOf.clear(); s.supOf.forEach((v, k) => supOf.set(k, v));
  }

  async function commit(
    mutate: () => string | null,
    send: () => PromiseLike<{ error: unknown }>,
  ): Promise<void> {
    const before = snapshot();
    const message = mutate();
    if (message === null) return; // nothing to do, message already shown
    render();
    say(message, 'ok');

    const { error } = await send();
    if (error) {
      restore(before);
      render();
      say('Ndryshimi nuk u ruajt — struktura u kthye siç ishte.', 'no');
      fail(error);
    }
  }

  function place(zoneEl: HTMLElement, item: HTMLElement): void {
    const volId = item.dataset.vol || '';
    const from = item.dataset.from || 'pool';
    const owner = item.dataset.owner || '';
    const kind = (zoneEl.dataset.zone || 'pool') as ZoneKind;
    const key = zoneEl.dataset.key || '';
    const p = people.get(volId);
    if (!p) return;

    // ---- back to the rail
    if (kind === 'pool') {
      if (p.role === 'koordinator') {
        if (!owner) return;
        return void commit(() => {
          coordOf.set(owner, (coordOf.get(owner) || []).filter(x => x !== volId));
          return `${p.name} u hoq nga koordinimi i ${unitCode(owner)}.`;
        }, () => sb.rpc('unit_coord_remove', { p_unit: owner, p_vol: volId }));
      }

      if (p.role === 'mbledhes') {
        return void commit(() => {
          const was = unitOf.get(volId);
          unitOf.delete(volId);
          const freed = [...supOf.entries()].filter(([, sid]) => sid === volId).map(([hid]) => hid);
          freed.forEach(hid => supOf.delete(hid));
          return `${p.name} doli nga ${was ? unitCode(was) : 'njësia'}` +
            (freed.length ? ` · ${freed.length} ndihmës mbetën në pritje.` : '.');
        }, () => sb.rpc('unit_assign_collector', { p_vol: volId, p_unit: null }));
      }

      return void commit(() => {
        supOf.delete(volId);
        return `${p.name} u hoq nga ekipi i mbledhësit.`;
      }, () => sb.rpc('unit_assign_helper', { p_vol: volId, p_collector: null }));
    }

    // ---- coordinator over a unit
    if (kind === 'coord') {
      const list = coordOf.get(key) || [];
      if (list.includes(volId)) return say(`${p.name} është tashmë koordinator i ${unitCode(key)}.`, 'no');
      const moving = from === 'coord' && owner && owner !== key;

      return void commit(() => {
        coordOf.set(key, [...list, volId]);
        if (moving) coordOf.set(owner, (coordOf.get(owner) || []).filter(x => x !== volId));
        const held = units.filter(u => (coordOf.get(u.id) || []).includes(volId)).length;
        return moving
          ? `${p.name} kaloi nga ${unitCode(owner)} te ${unitCode(key)}.`
          : `${p.name} koordinon ${unitCode(key)}` + (held > 1 ? ` — tani mban ${held} njësi.` : '.');
      }, async () => {
        const added = await sb.rpc('unit_coord_add', { p_unit: key, p_vol: volId });
        if (added.error || !moving) return added;
        return sb.rpc('unit_coord_remove', { p_unit: owner, p_vol: volId });
      });
    }

    // ---- authorized collector under a unit
    if (kind === 'collect') {
      if (unitOf.get(volId) === key) return say(`${p.name} ndodhet tashmë te ${unitCode(key)}.`, 'no');
      return void commit(() => {
        const prev = unitOf.get(volId);
        unitOf.set(volId, key);
        const team = [...supOf.values()].filter(sid => sid === volId).length;
        return prev
          ? `${p.name} u zhvendos nga ${unitCode(prev)} te ${unitCode(key)}` +
            (team ? ` me ${team} ndihmës.` : '.')
          : `${p.name} u caktua te ${unitCode(key)}.`;
      }, () => sb.rpc('unit_assign_collector', { p_vol: volId, p_unit: key }));
    }

    // ---- helper under a collector
    if (supOf.get(volId) === key) {
      return say(`${p.name} është tashmë nën ${people.get(key)?.name || 'këtë mbledhës'}.`, 'no');
    }
    return void commit(() => {
      supOf.set(volId, key);
      const lead = people.get(key)?.name || 'mbledhësin';
      const u = unitOf.get(key);
      return `${p.name} kaloi nën ${lead}${u ? ` te ${unitCode(u)}` : ''}.`;
    }, () => sb.rpc('unit_assign_helper', { p_vol: volId, p_collector: key }));
  }

  // ---- wire up -------------------------------------------------------------
  render();
  say(interactive ? 'Asnjë ndryshim ende.' : '');

  if (!interactive) return;

  detach = attachDnd({
    root: grid,
    itemSel: '[data-marble]',
    zoneSel: '[data-zone]',
    accepts: (zoneEl, item) => {
      const p = people.get(item.dataset.vol || '');
      if (!p) return false;
      return eligible(
        p,
        (zoneEl.dataset.zone || 'pool') as ZoneKind,
        zoneEl.dataset.key || '',
        item.dataset.from || 'pool',
      );
    },
    onDrop: place,
    onMiss: () => say('U lëshua jashtë — asgjë nuk ndryshoi.'),
    onReject: (_zoneEl, item) => {
      const p = people.get(item.dataset.vol || '');
      say(`Ky vend nuk e pranon ${p ? p.name : 'këtë vullnetar'}.`, 'no');
    },
    onPick: item => {
      const p = item && people.get(item.dataset.vol || '');
      say(p ? `${p.name} u mor — zgjidhni një vend të ndriçuar.` : 'U anulua.');
    },
  });
}
