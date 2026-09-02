import { sb } from '../api/client';
import { store } from '../state/store';
import { esc, truncate } from '../utils/security';
import { nf, fmtDate, fmtTime, dur } from '../utils/format';
import { getLocation } from '../utils/geo';
import { toast, fail } from '../components/toast';
import { slotsHtml } from '../components/slots';
import { initMap, mapZoom } from '../map/slippyMap';
import { shiftWhen, joinShift, leaveShift } from './shifts';
import { signedQrStripHtml, attachSignedQr } from '../components/signedQr';
import type { ActiveFieldCollector, MyCheckinItem, ShiftListItem, CheckinRow } from '../types/database';

export const CHECKIN_GRACE_MIN = 30;

export async function vField(go: (k: any) => void): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohet terreni…</div>';

  const qendra = store.isQendra();
  const [openShift, myShifts, activeNow, nextShift] = await Promise.all([
    sb
      .from('checkins')
      .select('*')
      .eq('volunteer_id', store.ME?.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.rpc('my_checkins', { p_limit: 25 }),
    sb.rpc('field_active'),
    qendra ? Promise.resolve({ data: null }) : sb.rpc('my_next_shift'),
  ]);

  const cur = openShift.data as CheckinRow | null;
  const mine = (myShifts.data || []) as MyCheckinItem[];
  const now = (activeNow.data || []) as ActiveFieldCollector[];
  const shRows = nextShift.data as ShiftListItem[] | ShiftListItem | null;
  const sh = Array.isArray(shRows) ? shRows[0] : shRows;

  const myTotal = mine.reduce((a, r) => a + (r.credited || 0), 0);
  const shared = mine.some(r => r.team_size > 1);

  view.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div>
        <h2 class="sec" style="margin:0">Terreni</h2>
        <p class="sub" style="margin:0">${qendra
          ? 'Kush është në terren pikërisht tani dhe ku. Turnet planifikohen dhe shihen te Turni.'
          : 'Turni i radhës i ekipit tuaj. Check-in-i hapet kur i vjen ora turnit, dhe turni mbyllet nga koordinatori ose mbledhësi që e hapi.'}</p>
      </div>
      <a class="btn ghost sm" href="https://referendum21.org/skeptik" target="_blank" rel="noopener" style="text-decoration:none;font-size:12.5px;color:var(--text-meta)">
        🧠 Përgjigje për skeptikët ↗
      </a>
    </div>

    ${fieldTopCardHtml(cur, sh, qendra)}

    <div class="grid g2">
      <div class="card">
        <h3>Në terren tani <span class="pill blue">${now.length}</span></h3>
        <div class="meta">Sipas njësisë. Koha numërohet nga check-in-i i parë i njësisë.
          Klikoni një fytyrë për emrin dhe rolin.</div>
        <div style="margin-top:10px">
          ${nowByUnit(now).map((u, i) => `
            <div class="file-item" style="gap:12px">
              <span class="unit-tag">${esc(u.code)}</span>
              <div style="flex:1;min-width:0">
                ${slotsHtml('nt' + i, u.people, 0, '', 'flush')}
              </div>
              <div style="text-align:right;flex:none">
                <div class="meta"><b>${dur(u.first)}</b></div>
                <div class="meta">nga ${fmtTime(u.first)}</div>
              </div>
            </div>`).join('') || '<div class="empty">Askush në terren tani.</div>'}
        </div>
      </div>

      <div class="card">
        <h3>Turnet e mia</h3>
        <div class="meta">${mine.length} turne · ${nf(myTotal)} nënshkrime gjithsej.</div>
        <div class="scroll-x" style="margin-top:10px">
          ${mine.length ? `
            <table class="tbl"><thead><tr>
              <th>Data</th><th>Njësia</th><th>Kohëzgjatja</th><th style="text-align:right">Firma</th></tr></thead><tbody>
              ${mine.map(r => `<tr>
                <td>${fmtDate(r.started_at)}</td>
                <td>${esc(r.unit_code || truncate(r.location_name, 20) || '—')}</td>
                <td>${r.ended_at ? dur(r.started_at, r.ended_at) : '<span class="pill ok">hapur</span>'}</td>
                <td style="text-align:right"><b>${nf(r.credited)}</b>
                  ${r.team_size > 1 ? `<div class="meta">ekip · ${r.team_size} veta</div>` : ''}</td></tr>`).join('')}
            </tbody></table>` : '<div class="empty">Ende pa turne.</div>'}
        </div>
        ${shared ? `<div class="hint">Te turnet në ekip shfaqet sa mblodhi i gjithë turni —
          ky është rezultati juaj bashkë me të tjerët. Te totali i fushatës numërohet një herë të vetme.</div>` : ''}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <div><h3 style="margin:0">Harta e mbledhësve aktivë</h3>
          <div class="meta">Vendndodhja e regjistruar në çastin e check-in-it.
            Shfaqen vetëm turnet e hapura.</div></div>
        <button class="btn sec sm" id="btn_refresh_field">↻ Rifresko</button>
      </div>
      <div class="map-wrap" id="map" style="margin-top:12px">
        <div class="map-tiles" id="map_tiles"></div>
        <div class="map-pins" id="map_pins"></div>
        <div class="map-zoom">
          <button id="btn_zoom_in" title="Afro">+</button>
          <button id="btn_zoom_out" title="Largo">−</button>
        </div>
        <div class="map-attr">© <a href="https://www.openstreetmap.org/copyright"
          target="_blank" rel="noopener">OpenStreetMap</a></div>
      </div>
      <div class="hint" id="map_hint"></div>
    </div>`;

  // Attach button events
  document.getElementById('btn_refresh_field')?.addEventListener('click', () => vField(go));
  document.getElementById('btn_zoom_in')?.addEventListener('click', () => mapZoom(1));
  document.getElementById('btn_zoom_out')?.addEventListener('click', () => mapZoom(-1));

  attachFieldTopCardEvents(cur, sh, go);

  // Initialize Slippy Map
  initMap(now.filter((c): c is ActiveFieldCollector & { lat: number; lng: number } => c.lat != null && c.lng != null));
}

export function nowByUnit(rows: ActiveFieldCollector[]): Array<{
  code: string;
  name: string;
  people: Array<{ name: string; role: string; photo: string | null }>;
  first: string;
}> {
  const by: Record<string, { code: string; name: string; people: Array<{ name: string; role: string; photo: string | null }>; first: string }> = {};
  (rows || []).forEach(c => {
    const code = c.unit_code || '—';
    const u = by[code] || (by[code] = { code, name: c.unit_name || '', people: [], first: c.started_at });
    u.people.push({ name: c.volunteer_name, role: c.role, photo: c.photo_path });
    if (new Date(c.started_at) < new Date(u.first)) u.first = c.started_at;
  });
  return Object.values(by).sort((a, b) =>
    (a.code === '—' ? 1 : 0) - (b.code === '—' ? 1 : 0) || a.code.localeCompare(b.code, 'sq')
  );
}

export function fieldTopCardHtml(cur: CheckinRow | null, sh: ShiftListItem | null, qendra: boolean): string {
  if (qendra) {
    return `<div class="notice">Roli juaj është në qendër: nuk i përkisni asnjë ekipi terreni,
      ndaj nuk bëni check-in te turnet. Turnet e planifikuara — të gjitha, nga të gjithë
      koordinatorët — i shihni te <a class="link" data-nav-tab="shifts">Turni</a>.</div>`;
  }

  if (cur) {
    const linked = !!cur.shift_id;
    const lead = !linked || (sh && sh.id === cur.shift_id && sh.i_am_lead);
    const head = `
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><h3 style="margin:0">📍 Në terren${sh && sh.id === cur.shift_id
              ? ': ' + esc(sh.unit_code + ' · ' + sh.unit_name)
              : (cur.location_name ? ': ' + esc(cur.location_name) : '')}</h3>
          <div class="meta">${sh && sh.id === cur.shift_id ? esc(shiftWhen(sh)) + ' · ' : ''}check-in
            ${fmtTime(cur.started_at)} · ${dur(cur.started_at)}
            ${sh && sh.id === cur.shift_id ? ' · ' + sh.checked_in_count + ' nga ekipi brenda' : ''}
            ${cur.lat ? ` · <a class="link" target="_blank" rel="noopener"
              href="https://www.google.com/maps?q=${cur.lat},${cur.lng}">harta</a>` : ''}</div></div>
        <span class="pill ok">turn i hapur</span>
      </div>`;

    if (lead) {
      return `<div class="card" style="margin-bottom:18px;border-color:var(--teal-l);box-shadow:0 0 0 3px #d5f2ee">
        ${head}
        ${signedQrStripHtml()}
        <label>Sa nënshkrime mblodhi ekipi gjithsej? *</label>
        <input id="co_sig" type="number" min="0" step="1" inputmode="numeric" placeholder="0"
               value="${cur.signatures || ''}">
        <label>Shënime (opsionale)</label>
        <textarea id="co_notes" placeholder="si shkoi, çfarë duhet ditur…">${esc(cur.notes || '')}</textarea>
        <div class="row" style="margin-top:13px">
          <button class="btn" id="co_btn">Mbyll turnin</button>
        </div>
        <div class="hint">${linked
          ? 'Me mbylljen e turnit dalin nga terreni edhe të gjithë ata të ekipit që bënë check-in, dhe numri u shfaqet secilit te "Turnet e mia".'
          : 'Turn i vjetër, pa planifikim — mbyllet vetëm për ju.'}</div>
      </div>`;
    }

    return `<div class="card" style="margin-bottom:18px;border-color:var(--teal-l);box-shadow:0 0 0 3px #d5f2ee">
      ${head}
      ${signedQrStripHtml()}
      <div class="notice" style="margin:12px 0 0">Turnin e mbyll
        <b>${esc(sh?.created_by_name || 'koordinatori ose mbledhësi që e hapi')}</b> —
        atëherë dilni automatikisht nga terreni dhe numri i nënshkrimeve ju shfaqet
        te <b>Turnet e mia</b>.</div>
      <div class="row" style="margin-top:12px">
        <button class="btn ghost sm" id="btn_cancel_shift">Anulo check-in-in</button>
      </div>
    </div>`;
  }

  if (sh) {
    const t0 = new Date(sh.starts_at).getTime();
    const t1 = new Date(sh.ends_at).getTime();
    const opensAt = t0 - CHECKIN_GRACE_MIN * 60000;
    const over = Date.now() > t1;
    const open = Date.now() >= opensAt && !over;
    const state = !sh.unit_is_open
      ? `<div class="notice warn" style="margin-top:12px">Njësia e këtij turni është e mbyllur
           nga qendra — check-in-i nuk bëhet dot derisa ta hapë.</div>`
      : over
      ? `<div class="notice warn" style="margin-top:12px">Ora e turnit kaloi${sh.i_am_lead
           ? ' — mbylleni që nënshkrimet të numërohen.' : ' dhe turni nuk u mbyll ende.'}</div>`
      : open
      ? `<div class="notice" style="margin-top:12px">Turni ka nisur — bëni check-in kur të mbërrini në vend.</div>`
      : `<div class="notice" style="margin-top:12px">Check-in-i hapet në
           <b>${fmtTime(new Date(opensAt))}</b>, ${CHECKIN_GRACE_MIN} minuta para fillimit.</div>`;

    return `<div class="card" style="margin-bottom:18px">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><h3 style="margin:0">Turni i radhës</h3>
          <div class="meta" style="text-transform:capitalize">${esc(shiftWhen(sh))}</div></div>
        <span class="unit-tag ${open ? 'ok' : ''}">${esc(sh.unit_code || '—')}</span>
      </div>
      <div class="meta" style="margin-top:5px">${esc(sh.unit_name || '')}${sh.notes ? ' · ' + esc(sh.notes) : ''}
        · e hapi ${esc(sh.created_by_name || '—')}</div>
      ${slotsHtml(sh.id, sh.signed, sh.capacity)}
      ${state}

      ${over && sh.i_am_lead ? `
        <label>Sa nënshkrime mblodhi ekipi gjithsej? *</label>
        <input id="co_sig" type="number" min="0" step="1" inputmode="numeric" placeholder="0">
        <label>Shënime (opsionale)</label>
        <textarea id="co_notes" placeholder="si shkoi, çfarë duhet ditur…"></textarea>
        <div class="row" style="margin-top:13px">
          <button class="btn" id="co_btn">Mbyll turnin</button>
        </div>` : over ? '' : `
        <label>Pika e saktë (opsionale)</label>
        <input id="ci_loc" placeholder="p.sh. para bashkisë, te hyrja e pazarit">
        <div class="row" style="margin-top:13px">
          <button class="btn green" id="ci_btn" ${open && sh.unit_is_open ? '' : 'disabled'}>📍 Bëj check-in</button>
          ${sh.i_am_in
            ? `<button class="btn red sm" id="btn_leave_next">Hiqem nga turni</button>`
            : `<button class="btn sec sm" id="btn_join_next">Regjistrohu në turn</button>`}
        </div>`}
      <div class="hint">Turnet e tjera të ekipit i gjeni te
        <a class="link" data-nav-tab="shifts">Turni</a>.</div>
    </div>`;
  }

  return `<div class="card" style="margin-bottom:18px">
    <h3>Ende pa turn të planifikuar</h3>
    <div class="meta">Check-in-i bëhet vetëm brenda një turni që e hap koordinatori
      ose mbledhësi juaj i autorizuar. Sapo të planifikohet një, do të shfaqet këtu.</div>
    <div class="row" style="margin-top:12px">
      <button class="btn ${store.isTeamLead() ? '' : 'sec'}" data-nav-tab="shifts">
        ${store.isTeamLead() ? 'Planifiko një turn' : 'Shiko Turnin'}</button>
    </div>
  </div>`;
}

export function attachFieldTopCardEvents(cur: CheckinRow | null, sh: ShiftListItem | null, go: (k: any) => void): void {
  document.querySelectorAll<HTMLElement>('[data-nav-tab]').forEach(el => {
    el.addEventListener('click', () => {
      const tab = el.dataset.navTab;
      if (tab) go(tab);
    });
  });

  if (cur) {
    attachSignedQr();
    const linked = !!cur.shift_id;
    const lead = !linked || (sh && sh.id === cur.shift_id && sh.i_am_lead);
    if (lead) {
      document.getElementById('co_btn')?.addEventListener('click', () => {
        if (linked && cur.shift_id) closeTeamShift(cur.shift_id, go);
        else closeOwnShift(cur.id, go);
      });
    } else {
      document.getElementById('btn_cancel_shift')?.addEventListener('click', () => cancelShift(cur.id, go));
    }
  } else if (sh) {
    const t1 = new Date(sh.ends_at).getTime();
    const over = Date.now() > t1;
    if (over && sh.i_am_lead) {
      document.getElementById('co_btn')?.addEventListener('click', () => closeTeamShift(sh.id, go));
    } else if (!over) {
      document.getElementById('ci_btn')?.addEventListener('click', () => checkIn(sh.id, go));
      document.getElementById('btn_leave_next')?.addEventListener('click', async () => {
        await leaveShift(sh.id);
        vField(go);
      });
      document.getElementById('btn_join_next')?.addEventListener('click', async () => {
        await joinShift(sh.id);
        vField(go);
      });
    }
  }
}

export async function checkIn(shiftId: string, go: (k: any) => void): Promise<void> {
  const btn = document.getElementById('ci_btn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Po merret vendndodhja…';
  }
  const pos = await getLocation();
  if (btn) btn.textContent = 'Po ruhet…';

  const locInput = document.getElementById('ci_loc') as HTMLInputElement | null;
  const { error } = await sb.rpc('shift_check_in', {
    p_shift: shiftId,
    p_lat: pos?.lat ?? null,
    p_lng: pos?.lng ?? null,
    p_location: (locInput?.value || '').trim() || null,
    p_city: store.ME?.city || null,
  });

  if (btn) {
    btn.disabled = false;
    btn.textContent = '📍 Bëj check-in';
  }
  if (error) return fail(error);

  toast(pos ? 'Check-in u regjistrua. Punë të mbarë!' : 'Check-in u regjistrua, por pa vendndodhje — nuk dilni në hartë.');
  vField(go);
}

export async function closeTeamShift(shiftId: string, go: (k: any) => void): Promise<void> {
  const sigInput = document.getElementById('co_sig') as HTMLInputElement | null;
  const notesInput = document.getElementById('co_notes') as HTMLTextAreaElement | null;
  const btn = document.getElementById('co_btn') as HTMLButtonElement | null;

  const sig = parseInt(sigInput?.value || '', 10);
  if (isNaN(sig) || sig < 0) return fail('Shkruani sa nënshkrime u mblodhën (0 nëse asnjë).');

  if (
    !confirm(
      `Të mbyllet turni me ${nf(sig)} nënshkrime? Dalin nga terreni të gjithë ata të ekipit që bënë check-in.`
    )
  ) {
    return;
  }

  if (btn) btn.disabled = true;
  const { error } = await sb.rpc('shift_check_out', {
    p_shift: shiftId,
    p_signatures: sig,
    p_notes: (notesInput?.value || '').trim() || null,
  });
  if (btn) btn.disabled = false;

  if (error) return fail(error);
  toast(`Turni u mbyll · ${nf(sig)} nënshkrime. Faleminderit!`);
  vField(go);
}

export async function closeOwnShift(id: string, go: (k: any) => void): Promise<void> {
  const sigInput = document.getElementById('co_sig') as HTMLInputElement | null;
  const notesInput = document.getElementById('co_notes') as HTMLTextAreaElement | null;
  const btn = document.getElementById('co_btn') as HTMLButtonElement | null;

  const sig = parseInt(sigInput?.value || '', 10);
  if (isNaN(sig) || sig < 0) return fail('Shkruani sa nënshkrime u mblodhën (0 nëse asnjë).');

  if (btn) btn.disabled = true;
  const { error } = await sb.rpc('checkin_close_own', {
    p_id: id,
    p_signatures: sig,
    p_notes: (notesInput?.value || '').trim() || null,
  });
  if (btn) btn.disabled = false;

  if (error) return fail(error);
  toast(`Turni u mbyll · ${nf(sig)} nënshkrime. Faleminderit!`);
  vField(go);
}

export async function cancelShift(id: string, go: (k: any) => void): Promise<void> {
  if (!confirm('Të anulohet ky check-in? Turni nuk do të numërohet për ju.')) return;
  const { error } = await sb.from('checkins').delete().eq('id', id);
  if (error) return fail(error);
  vField(go);
}
