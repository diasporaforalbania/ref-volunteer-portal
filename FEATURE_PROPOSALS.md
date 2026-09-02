# FEATURE_PROPOSALS.md — Field Operations & Productivity Enhancements

> **Context:** Referendum 21/2024 Volunteer Portal (`ref-volunteer-portal`)  
> **Audience:** Developers & AI Engineering Agents (Antigravity, Cursor, Claude, Codex)  
> **Status:** Proposed / Agent-Ready Specification

---

## 📌 Executive Summary

To accelerate signature collection and eliminate daily field friction for volunteers (*Ndihmës* & *Mbledhës*) and coordinators, this document defines 5 high-leverage features. Each specification includes data contracts, UI touchpoints, security constraints, and acceptance criteria.

---

## 1. 💡 In-App Volunteer Feedback & Suggestion System

### Problem
Volunteers in the field encounter bugs, UX bottlenecks, and have high-value feature ideas, but lack a direct, structured channel to communicate with developers without leaving the portal.

### Solution & UX
* A subtle floating trigger button `💡 Sugjero një ide` (or header icon) available on all screens.
* Lightweight modal asking for:
  * **Category:** `💡 Veçori e re (Feature)` | `⚡ Përmirësim (Improvement)` | `🐞 Raporto problem (Bug)`
  * **Title:** Concise summary (max 100 chars).
  * **Description:** Detailed feedback (max 1,000 chars).
* **Auto-Captured Context (Invisible):** Volunteer ID, role, current route/tab, device/browser OS, screen resolution.

### Data Model & RLS (`schema.sql`)
```sql
create table if not exists public.feedback (
  id             uuid primary key default gen_random_uuid(),
  volunteer_id   uuid references public.volunteers(id) on delete set null,
  volunteer_name text,
  volunteer_role text,
  unit_code      text,
  category       text not null check (category in ('feature', 'improvement', 'bug')),
  title          text not null,
  description    text not null,
  page_route     text,
  device_info    text,
  status         text not null default 'new' check (status in ('new', 'reviewed', 'planned', 'done')),
  created_at     timestamptz not null default now()
);

alter table public.feedback enable row level security;
create policy fb_insert on public.feedback for insert to authenticated with check (true);
create policy fb_read   on public.feedback for select to authenticated
  using (volunteer_id = auth.uid() or public.vol_is_admin() or public.vol_role() = 'it');
create policy fb_update on public.feedback for update to authenticated
  using (public.vol_is_admin() or public.vol_role() = 'it');
```

### Acceptance Criteria
- [ ] Submitting feedback shows an instant confirmation toast and closes the modal.
- [ ] Devs/Admins can view and triage feedback directly in the Admin view under a "Feedback" tab.
- [ ] Zero third-party script tags (no CSP violations or bundle bloat).

---

## 2. 📥 Multi-View CSV / Excel Export (Paneli & Turnet)

### Problem
While *Historiku* has shift-level CSV export, Coordinators and HQ cannot currently export municipal rollup totals or shift attendance rosters for offline planning and daily reconciliation.

### Solution & UI Placement
1. **Paneli (Unit Board):** Add `📥 Eksporto Zonat (CSV)` button.
   * **Columns:** `Kodi`, `Zona/Bashkia`, `Qarku`, `Objektivi`, `Firma të Mbledhura`, `% e Realizuar`, `Koordinatorët`, `Statusi (Hapur/Mbyllur)`.
2. **Turnet (Shifts):** Add `📥 Eksporto Orarin (CSV)` button.
   * **Columns:** `Data`, `Ora Fillimit`, `Ora Mbarimit`, `Zona`, `Hapur Nga`, `Kapaciteti`, `Të Regjistruar`, `Pjesëmarrësit`.

### Technical Architecture
* Use client-side CSV generator utility ([`src/utils/format.ts`](src/utils/format.ts)) to build RFC 4180 compliant CSV blobs with UTF-8 BOM (`\uFEFF`) for seamless opening in Microsoft Excel.
* Zero additional dependencies.

### Acceptance Criteria
- [ ] Export files download immediately with localized datetime naming: `zonat-referendumi-YYYY-MM-DD.csv`.
- [ ] Albanian diacritics (`ë`, `ç`) render correctly in Excel.
- [ ] Strictly Zero-PII: No phone numbers or private emails included in exports.

---

## 3. 📸 Signature Sheet Photo Upload & Digital Custody

### Problem
Physical petition sheets can be damaged by weather or misplaced during field transport. If a paper sheet is lost before arriving at HQ, the signatures are permanently voided.

### Solution & Workflow
1. **Shift Checkout Hook:** When a team lead closes a shift via `shift_check_out` on *Terreni*, offer an optional photo upload step: *"Ngarko fotot e formularëve të plotësuar"*.
2. **Storage:** Photos are compressed on-device ([`src/utils/image.ts`](src/utils/image.ts)) to max 1600px / 80% JPEG and uploaded to a strictly private Supabase storage bucket `vol-sheets`.
3. **Audit Trail:** Only Central Jurists and Admins can view/audit sheet photos in the portal.

### Security & Privacy Rules (MANDATORY)
> [!CAUTION]
> Physical sheets contain citizen national ID numbers. Images **MUST NEVER** be stored in public buckets or accessible via public URLs.

```sql
-- Private bucket for sheet audit
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vol-sheets', 'vol-sheets', false, 15728640, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy sheet_read on storage.objects for select to authenticated
  using (bucket_id = 'vol-sheets' and (public.vol_is_center() or owner = auth.uid()));
```

### Acceptance Criteria
- [ ] Photos upload reliably even on slow 3G mobile connections.
- [ ] Shift checkout succeeds even if photo upload is skipped.
- [ ] Jurist dashboard displays thumbnail grid with zoom-in modal for signature verification.

---

## 4. 📱 "Ndihmësi i Xhepit" (Field FAQ & 10-Second Pitch Drawer)

### Problem
Volunteers on the street face rapid citizen questions (*"Pse duhet referendumi?", "A është e ligjshme?", "A më rrezikohen të dhënat?"*). Hesitation leads to lost signatures.

### Solution & UI Placement
* Floating badge/button on **Terreni** tab: `⚡ Ndihmësi i Xhepit`.
* Opens a fast bottom-sheet drawer with 3 tabs:
  1. **30-Sekonda Pitch:** 3 concise bullet points for passersby.
  2. **Top 5 Pyetje-Përgjigje:** Instant answers to common doubts (KQZ legality, privacy of ID cards).
  3. **Baza Ligjore:** Key article numbers (Kushtetuta Neni 150, Kodi Zgjedhor).
* **100% Offline:** Static TS dictionary bundled directly into the client.

### Acceptance Criteria
- [ ] Opens in <50ms with zero network request.
- [ ] Readable in high-contrast outdoor sunlight.
- [ ] Includes 1-tap "Kopjo tekstin" for sharing via WhatsApp/SMS to citizens.

---

## 5. 🔢 Official Sheet Serial Number Tracker

### Problem
Official petition sheets are serialized legal documents. Central logistics needs to know which serial numbers (`#1001` – `#1020`) are assigned, filled, or voided per unit.

### Solution & Data Model
* Add optional fields to shift check-in/check-out:
  * `sheet_start_no`: e.g. `1040`
  * `sheet_end_no`: e.g. `1045`
  * `void_sheets_count`: e.g. `1` (damaged/spoiled sheets)

### Schema Addition (`schema.sql`)
```sql
alter table public.shifts add column if not exists sheet_start_no integer;
alter table public.shifts add column if not exists sheet_end_no   integer;
alter table public.shifts add column if not exists spoiled_sheets integer default 0;
```

---

## 📊 Implementation Prioritization Matrix

| Feature | Persona | Impact | Effort | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **1. In-App Feedback System** | All Volunteers / Devs | High | 🟢 Low (1 day) | **P0** |
| **2. Zone & Shift CSV Exports** | Coordinators / HQ | High | 🟢 Low (0.5 day) | **P0** |
| **4. Field FAQ & Pitch Drawer** | Field Volunteers | High | 🟢 Low (0.5 day) | **P1** |
| **5. Sheet Serial Number Tracker** | Logistics / Jurists | Medium | 🟢 Low-Med (1 day) | **P1** |
| **3. Sheet Photo Upload & Custody** | Jurists / Team Leads | Very High | 🟡 Medium (2 days) | **P2** |

---

## 🤖 Instructions for AI Engineering Agents Implementing These Features

1. **Keep Vanilla Architecture:** Do not introduce React/Vue or heavy UI libraries. Use existing component patterns (`openModal`, `toast`, `esc`).
2. **Zero-PII Compliance:** Never leak volunteer personal phone numbers or citizen data in public endpoints or client stores.
3. **Parity Rule:** Ensure all new RPC functions are reflected in both `schema.sql` and `fix-user-profile.sql`.
4. **Verification Gate:** Run `npm test` and `npm run typecheck` before committing.
