# AGENTS.md — AI Engineering Guide for `ref-volunteer-portal`

Welcome, AI Agent (Antigravity, Claude, Codex, Cursor, or peer agents).
This document provides the definitive context, architecture, security rules, and development guidelines for working on **`ref-volunteer-portal`**.

---

## 🎯 1. Project Purpose & Scope

**`ref-volunteer-portal`** is the operational web platform and backend interface for managing volunteers, collection units, field check-ins, physical signature counts, and campaign reports for the **Referendum 21/2024** civic initiative in Albania.

* **Production URL:** `https://portal.referendum21.org`
* **Public Tally Endpoint:** `https://portal.referendum21.org/api/count`
* **Target Audience:** Campaign volunteers, coordinators, regional jurists, collectors, and national administrators.

---

## 🏗️ 2. Tech Stack & Architecture

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Frontend Framework** | **Vanilla TypeScript + Vite** | Lightweight SPA without React/Vue. State managed via `src/state/store.ts`. |
| **Styling** | **Custom Vanilla CSS** | Located in `src/styles/main.css`. Supports light/dark mode and responsive layouts. |
| **Database & Auth** | **Supabase (PostgreSQL 15+)** | Schema defined in `schema.sql`. Strictly governed by Row-Level Security (RLS) & Triggers. |
| **Edge Compute / API** | **Cloudflare Pages & Workers** | Edge API functions in `functions/api/` (`count.js`, `send-push.js`) and `src/worker.ts`. |
| **Testing** | **Node.js Native Test Runner** | Unit and bridge security tests in `tests/bridge/*.test.mjs`. |

---

## 🔒 3. Absolute Security & Architectural Rules (MANDATORY)

Every AI agent modifying this repository **MUST** adhere to these immutable rules:

### A. Zero Privilege Escalation in Frontend
* **Never** trust role or status assignments sent from the client.
* Role assignment is strictly enforced inside PostgreSQL triggers (`handle_new_volunteer()`).
* New signups **always** default to `role = 'ndihmes'` and `status = 'pending'`. Only administrators can elevate roles via `vol_set_role()` and `vol_decide_pending()`.

### B. Row-Level Security (RLS) & PII Isolation
* `public.volunteer_private` stores phone numbers, emails, and emergency contacts.
* **RLS Rule:** Volunteers can only see their own private info (`auth.uid() = id`). Coordinators can only see approved volunteers within their assigned units. Never expose unapproved volunteers' PII nationwide.

### C. Edge API Bridge Integrity (`/api/count`)
* `functions/api/count.js` is the public tally source for `referendum21.org` (`ref-landing-page`).
* **Always sanitize payload:** Return strictly `{ signatures: integer, goal: integer, week: integer, updated: string, generated_at: string }`. `week` is signatures closed in the last 7 days (aggregate only).
* **Zero PII:** Never leak volunteer IDs, names, or internal database metadata through public endpoints.
* **Origin Restriction:** Gated by dynamic CORS allowlist (`referendum21.org`, `localhost`, `*.pages.dev`).

### D. PostgreSQL Functions & Security Definers
* Every `SECURITY DEFINER` function in `schema.sql` **MUST** include `SET search_path = public` to prevent schema hijacking.
* Never use raw SQL string concatenation; always parameterize queries and stored procedures.

---

## 📁 4. Project Structure Map

```
ref-volunteer-portal/
├── src/
│   ├── api/                   # Supabase client initialization & storage helpers
│   ├── components/            # UI components (badge, header, modal, toast, unitBoard)
│   ├── map/                   # OpenStreetMap & Leaflet interactive map logic
│   ├── state/                 # Reactive client store (store.ts) and role constants
│   ├── styles/                # CSS design system (main.css)
│   ├── types/                 # TypeScript interfaces (database.ts, app.ts)
│   ├── utils/                 # Security validators (safeUrl, esc), formatting, geo
│   ├── views/                 # View controllers (admin, auth, history, home, news, panel, reports)
│   ├── main.ts                # Application entry point & router
│   └── worker.ts              # Cloudflare Worker entry point
├── functions/api/             # Cloudflare Pages Functions (/api/count, /api/send-push)
├── tests/bridge/              # Automated security, CORS, Zero-PII, & Auth test suites
├── schema.sql                 # Complete canonical Supabase PostgreSQL schema
├── fix-user-profile.sql       # Permission fix and admin activation script
├── docker-compose.yml         # Offline local database stack (PostgreSQL + PostgREST)
├── wrangler.toml              # Cloudflare Pages / Worker configuration
├── _headers                   # Production security headers (CSP, HSTS, X-Frame-Options)
├── _redirects                 # SPA client routing fallback
└── package.json               # Scripts & dependencies
```

---

## ⚡ 5. Standard Commands for AI Agents

Run these commands when developing and verifying changes:

```bash
# 1. Typecheck TypeScript files
npm run typecheck

# 2. Run automated test suite (Bridge security, CORS, Zero-PII, URL routing)
npm run test:bridge

# 3. Full quality verification gate (Typecheck + Tests)
npm test

# 4. Build Vite production bundle
npm run build

# 5. Start Vite local development server
npm run dev

# 6. Test with local Cloudflare Wrangler Pages emulator
npm run pages:dev
```

---

## 🤖 6. AI Agent Guidelines for Writing Code

1. **Verify Before and After:** Always run `npm test` before committing any changes to ensure zero regressions.
2. **Preserve Comments:** Keep existing documentation, code comments, and docstrings intact.
3. **No Unencrypted Secrets in Git:** Never commit `.env`, `.dev.vars`, or service role keys.
4. **RPC Function Parity:** When adding or modifying RPC calls in `src/views/`, ensure matching functions and `GRANT EXECUTE` statements exist in `schema.sql` and `fix-user-profile.sql`.
5. **Clean Diffs:** Avoid reformatting entire files when making small, focused fixes.
