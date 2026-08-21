# Referendumi — Portali i Vullnetarëve

Portali digjital i menaxhimit të vullnetarëve, organizimit të turneve në terren dhe auditimit të mbledhjes së nënshkrimeve për nismën e referendumit qytetar (50,000 nënshkrime).

---

## 🎯 Veçoritë Kryesore

* 🪪 **Karta Dixhitale & Verifikimi Publik:** Çdo vullnetar pajiset me kartë zyrtare me kod unik (`V-XXXX`) dhe **QR Code**. Qytetarët dhe vëzhguesit mund ta verifikojnë menjëherë vullnetarin në kohë reale duke skanuar kodin ose në `/?v=KODI`.
* 📍 **Terreni & Check-In me GPS:** Planifikim turnesh, regjistrim pjesëmarrësish në stenda/njësi dhe check-in/check-out me verifikim të vendndodhjes në hartë interaktive (OpenStreetMap).
* 📡 **Arkitekturë Offline-First:** Në mungesë valësh ose lidhjeje interneti, veprimet e turneve ruhen lokalisht në **IndexedDB** ([`src/utils/syncQueue.ts`](src/utils/syncQueue.ts)) dhe sinkronizohen automatikisht sapo pajisja lidhet me rrjetin.
* 🔒 **Siguri e Blinduar në 4 Nivele:**
  1. **Trigger-at e regjistrimit** refuzojnë çdo tentativë për manipulim rolesh ose miratimi.
  2. **Revokim i lejeve direkte** në nivel kolonash në PostgreSQL (`UPDATE` i bllokuar për statusin/rolin).
  3. **Row-Level Security (RLS)** mbron të dhënat personale (PII) dhe informacionin e kontaktit.
  4. **Procedurat `SECURITY DEFINER`** me `search_path = public` kryejnë të gjitha veprimet administrative.
* ⚡ **Ura e Sigurt e Numëruesit në Skaj (Edge API Bridge):** Endpoint me performancë të lartë në Cloudflare Workers/Pages Functions ([`functions/api/count.js`](functions/api/count.js)) që furnizon faqen kryesore ([`referendum21.org`](https://referendum21.org)) me numrin zyrtar të firmave, pa ekspozuar kredencialet e bazës së të dhënave (Zero-PII & Origin allowlisting).
* 🔔 **Njoftime në Kohë Reale & Web Push:** Supabase Realtime Channels (WebSockets) dhe mbështetje për njoftime celulare (Web Push VAPID).

---

## 🛠️ Arkitektura & Teknologjitë

| Shtresa | Teknologjia | Përshkrimi |
| :--- | :--- | :--- |
| **Frontend** | TypeScript, Vite, Vanilla CSS | PWA e shpejtë, pa frameworks të rëndë, optimizuar për celularë |
| **Harta** | Slippy Canvas Engine | Renderues me performancë të lartë mbi OpenStreetMap me cache pllakash në Service Worker |
| **Database** | PostgreSQL (Supabase) | RLS, stored procedures, indekse të optimizuara dhe views të sigurta |
| **Edge & Hosting** | Cloudflare Pages & Functions | Shpërndarje globale në skaj, rregulla sigurie CSP/HSTS dhe caching inteligjent |

---

## 📋 Parakushtet

Për të ekzekutuar projektin lokalisht, sigurohuni që keni të instaluar:
* **Node.js** (v18.0.0 ose më i ri)
* **npm** (v9.0.0 ose më i ri)
* Një projekt aktiv në **[Supabase](https://supabase.com)** (ose instancë lokale Supabase)

---

## 🔑 Konfigurimi i Variablave të Mjedisit

Projekti ndan variablat midis **Frontend-it (Vite)** dhe **Funksioneve Edge (Cloudflare Pages Functions)**.

### Pasqyra e Variablave:

| Variabli | Përdoret Nga | Lloji | Përshkrimi |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Frontend (Vite) | Publik | URL-ja e projektit Supabase (`https://xyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Frontend (Vite) | Publik | Çelësi publik `anon` i Supabase |
| `VITE_VAPID_PUBLIC_KEY` | Frontend (Vite) | Publik | **Opsionale** — vetëm për `npm run dev`. Në prodhim çelësin ia jep Worker-i nga `VAPID_PUBLIC_KEY` |
| `VITE_DEFAULT_GOAL` | Frontend (Vite) | Publik | Objektivi fillestar i nënshkrimeve (`50000`) |
| `SUPABASE_URL` | Edge Functions / Wrangler | Server | URL-ja e Supabase për `/api/count` & `/api/send-push` |
| `SUPABASE_ANON_KEY` | Edge Functions / Wrangler | Secret | Çelësi `anon` për kërkesat e funksioneve edge te Supabase |
| `VAPID_PUBLIC_KEY` | Worker (runtime) | Publik — **te `wrangler.toml`**, jo te paneli | Çelësi publik VAPID. E lexojnë të dyja anët: dërguesi për të nënshkruar, dhe Worker-i që ia kalon shfletuesit si `<meta name="vapid-public-key">` |
| `VAPID_PRIVATE_KEY` | Edge Functions / Wrangler | Secret | Çelësi privat VAPID për nënshkrimin e njoftimeve Push |
| `VAPID_SUBJECT` | Edge Functions / Wrangler | Server | Kontakti administrativ (p.sh. `mailto:admin@referendum21.org`) |

---

## 🚀 Udhëzuesi i Nisjes Lokale (Local Development)

### 1. Klononi Repozitorin dhe Instaloni Varësitë

```bash
git clone https://github.com/diasporaforalbania/ref-volunteer-portal.git
cd ref-volunteer-portal
npm install
```

### 2. Konfiguroni Skedarët e Mjedisit

Krijoni skedarët `.env` dhe `.dev.vars` nga shembulli:

```bash
# Për zhvillimin me Vite
cp .env.example .env

# Për simulin e Cloudflare Pages me Wrangler
cp .env.example .dev.vars
```

Plotësoni çelësat tuaj në `.env`:
```ini
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
VITE_DEFAULT_GOAL=50000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_SUBJECT=mailto:admin@referendum21.org
```

### 3. Konfigurimi i Bazës së të Dhënave (Zgjidhni njërën nga mënyrat)

Mund të zgjidhni midis **Bazës Lokale (pa cloud)** ose **Supabase Cloud**:

#### 🟢 Opsioni A: Baza Lokale me Docker (100% Offline / Pa Cloud)
Nëse dëshironi të zhvilloni pa u lidhur fare me shërbime në re dhe pa krijuar llogari:
```bash
# Nis PostgreSQL dhe PostgREST lokalisht me skemën e inicializuar automatikisht
docker compose up -d
```
* **REST API Lokale:** `http://localhost:54321`
* **Porta PostgreSQL:** `localhost:5432` (`user: postgres`, `password: postgrespassword`)
* Te `.env` mjafton të vendosni:
  ```ini
  VITE_SUPABASE_URL=http://localhost:54321
  VITE_SUPABASE_ANON_KEY=local-dev-key
  ```

#### 🟡 Opsioni B: Baza Lokale me Supabase CLI (me Dashboard Vizual)
Nëse dëshironi të gjithë ambientin e Supabase lokalisht bashkë me panelin vizual Studio:
```bash
# 1. Nisni shërbimet lokale të Supabase (kërkon Docker aktiv)
npx supabase start

# 2. Ngarkoni skemën e plotë
npx supabase db execute --file schema.sql
```
* **Paneli Vizual (Studio Dashboard):** `http://127.0.0.1:54323`
* **API URL:** `http://127.0.0.1:54321`
* Merrni `anon key` që shfaqet në terminal dhe vendoseni te `.env`.

#### 🔵 Opsioni C: Konfigurimi në Supabase Cloud (1-Hap i Thjeshtë)
Nëse po lidheni me projektin në re në Supabase:
1. Hapni **[Supabase Dashboard](https://supabase.com/dashboard)** → Zgjidhni projektin → **SQL Editor**.
2. Ngjisni përmbajtjen e skedarit [`schema.sql`](schema.sql) dhe shtypni **Run** (skedari krijon me 1 hap të gjitha tabelat, procedurat, trigger-at dhe lejet e nevojshme).
3. Shkoni te **Storage** dhe krijoni këto 3 buckets:
   * `vol-photos` — **Public** (fotot e kartës së vullnetarit)
   * `vol-materials` — **Public** (materialet dhe dokumentet ligjore)
   * `vol-reports` — **Private / Authenticated** (fotot e raportimit të incidenteve)

### 4. Ekzekutoni Portalin Lokalisht

#### Mënyra A: Zhvillim me Vite (E rekomanduar)
Vite vjen i konfiguruar me middleware të integruar për `/api/count` në [`vite.config.ts`](vite.config.ts):
```bash
npm run dev
```
Hapni shfletuesin në: **`http://localhost:3000`**
* Portali: `http://localhost:3000`
* API e numëruesit live: `http://localhost:3000/api/count`

#### Mënyra B: Simulimi i plotë me Cloudflare Pages (Wrangler)
Për të testuar aplikacionin fiks si në prodhim me motorin e Cloudflare Pages Functions:
```bash
# Ndërtoni asetet dhe nisni Wrangler Pages Dev
npm run build
npm run pages:dev
```
Hapni shfletuesin në: **`http://localhost:8788`**

---

## 🧪 Testimi dhe Verifikimi i Kodit

Projekti përmban një suitë të plotë testesh automatike për verifikimin e tipave dhe të sigurisë së API-ve:

```bash
# Kontrollon të gjitha tipet TypeScript
npm run typecheck

# Ekzekuton testet e sigurisë dhe urës CORS / Zero-PII
npm run test:bridge

# Ekzekuton të gjitha testet dhe verifikon build-in
npm test
npm run build
```

---

## 🌐 Publikimi në Cloudflare Pages (Production Deployment)

### Hapi 1: Lidhni Repozitorin në Cloudflare

1. Hyni në **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. Navigoni te: **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Zgjidhni repozitorin: `diasporaforalbania/ref-volunteer-portal`.

### Hapi 2: Konfigurimi i Parametrave të Ndërtimit (Build Settings)

Plotësoni fushat si më poshtë:
* **Framework preset:** `None`
* **Build command:** `npm run build`
* **Build output directory:** `dist`
* **Root directory:** `/`

### Hapi 3: Konfigurimi i Variablave të Mjedisit në Cloudflare

Te skeda **Settings** → **Environment variables** të projektit në Cloudflare Pages, shtoni variablat për **Production** dhe **Preview**:

#### 1. Variablat e Ndërtimit të Frontend-it (Build Variables):
* `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
* `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
* `VITE_DEFAULT_GOAL` = `50000`

> `VITE_VAPID_PUBLIC_KEY` **nuk duhet** këtu. Çelësi publik i njoftimeve shkon te
> shfletuesi në kohë ekzekutimi, nga `VAPID_PUBLIC_KEY` më poshtë — ndaj ndërrimi
> i çelësit kërkon vetëm ripublikim, jo rindërtim. Më parë ai ishte variabël
> ndërtimi, dhe po të harrohej këtu paketa dilte me çelës bosh dhe çdo vullnetar
> lexonte «Njoftimet nuk janë aktivizuar ende nga qendra».

#### 2. Variablat e Worker-it (runtime)

Vetëm **dy**, dhe të dyja si **Secret**:

* `VAPID_PRIVATE_KEY` (**Type: Secret**)
* `SUPABASE_SERVICE_ROLE_KEY` (**Type: Secret**) — Supabase → Project Settings → API → `service_role`

Gjithçka tjetër publike (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DEFAULT_GOAL`,
`VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`) jeton te `[vars]` në `wrangler.toml`.

> **Pse Secret dhe jo Variable.** Me një bllok `[vars]` prezent, wrangler-i i
> **fshin të gjitha** variablat e thjeshta përpara se të vendosë ato të
> konfigurimit — pra një `Variable` e shtuar te paneli zhduket në publikimin e
> radhës. Sekretet nuk preken kurrë nga një publikim. Po i vendosët këto dy si
> `Variable`, njoftimet punojnë derisa të bëni push-in e ardhshëm, pastaj
> ndalen pa asnjë shenjë.

> Mos e shtoni `VAPID_PUBLIC_KEY` edhe te paneli: e ka `wrangler.toml`, dhe dy
> burime për të njëjtin emër janë vetëm mënyrë për t'i parë të shkojnë jashtë sinkroni.

### Hapi 4: Vendosja e Domain-it të Personalizuar (Custom Domain)

1. Te faqja e projektit në Cloudflare Pages, klikoni skedën **Custom domains**.
2. Klikoni **Set up a custom domain**.
3. Vendosni domain-in: **`portal.referendum21.org`**.
4. Cloudflare do të konfigurojë automatikisht regjistrin DNS CNAME dhe certifikatën SSL/TLS.

---

## 🔗 Komunikimi me Faqen Kryesore (`ref-landing-page`)

Portali i vullnetarëve shërben si burimi i vetëm i të dhënave për numrin e nënshkrimeve të mbledhura:

```
┌─────────────────────────────────────────┐         GET /api/count         ┌──────────────────────────────────────────────┐
│            ref-landing-page             │ ─────────────────────────────> │             ref-volunteer-portal             │
│        (https://referendum21.org)       │ <───────────────────────────── │       (https://portal.referendum21.org)      │
│                                         │      { signatures, goal }      │                                              │
│  • Nuk ka lidhje direkte me Supabase    │                                │  • Endpoint: functions/api/count.js          │
│  • Zbulon automatikisht portet lokale   │                                │  • Mbrojtje me Origin CORS Allowlist         │
│  • Rezervë statike në signatures.json   │                                │  • Zero-PII sanitization & 60s Edge Caching  │
└─────────────────────────────────────────┘                                └──────────────────────────────────────────────┘
                                                                                                  │
                                                                                                  ▼
                                                                                   ┌──────────────────────────────┐
                                                                                   │     Supabase PostgreSQL      │
                                                                                   │  (public.signature_totals)   │
                                                                                   └──────────────────────────────┘
```

---

## 📂 Struktura e Dosjeve

```
ref-volunteer-portal/
├── src/                               # Kodi burimor (TypeScript)
│   ├── api/                           # Klienti Supabase, Realtime dhe Storage
│   │   ├── client.ts                  # Inicializimi i sigurt i Supabase
│   │   ├── realtime.ts                # Dëgjuesit WebSockets
│   │   └── storage.ts                 # Ngarkimi dhe URL-të e fotove/dokumenteve
│   ├── components/                    # Komponentët UI (Karta, Modalet, Toast, Pema)
│   ├── map/                           # Motori i hartës Canvas mbi OpenStreetMap
│   ├── state/                         # Store reaktiv qendror dhe matricat e roleve
│   ├── styles/                        # Dizajni CSS modular dhe responsiv
│   ├── types/                         # Tipizimi TypeScript (Database & App)
│   ├── utils/                         # Formati, GPS, pastrimi XSS, Radha IndexedDB
│   ├── views/                         # Pamjet (Karta, Terreni, Turnet, Admin, etj.)
│   └── main.ts                        # Pika hyrëse e aplikacionit
├── functions/                         # Cloudflare Pages Functions (Edge API)
│   └── api/
│       ├── count.js                   # GET /api/count (Edge Tally API me CORS & Zero-PII)
│       └── send-push.js               # Dërgimi i njoftimeve Web Push
├── tests/                             # Suita e testeve automatike
│   └── bridge/                        # Testet e CORS, lejeve dhe sanitizimit të API-së
├── public/                            # Asetet statike (Ikonat, Manifest, _headers)
├── _headers                           # Rregullat e sigurisë (CSP, HSTS, X-Frame-Options)
├── schema.sql                         # Skema e plotë SQL e bazës së të dhënave
├── fix-user-profile.sql               # Skripti i konfigurimit të roleve dhe lejeve RLS
├── vite.config.ts                     # Konfigurimi i Vite me dev middleware
└── package.json                       # Varësitë dhe skriptet npm
```

---

## 🛡️ Siguria & Privatësia

* **Zero-PII në Publik:** Të gjitha të dhënat e kontaktit të vullnetarëve (telefoni, email-i, kontakti i urgjencës) ruhen në tabelën e izoluar `public.volunteer_private` me politika strikte RLS.
* **Auditimi i Veprimeve:** Çdo ndryshim roli, miratim turni ose modifikim kërkese regjistrohet në mënyrë të auditueshme në bazën e të dhënave.
* **Mbrojtje kundër XSS & Injection:** Çdo hyrje nga përdoruesi sanitizohet me `esc()` dhe protokollet e jashtme kufizohen vetëm në `http:`/`https:`.

---

## 📜 Licenca

Ky projekt është pjesë e nismës qytetare për referendumin. Të gjitha të drejtat janë të mbrojtura.
