# `GET /api/points` — Pikat aktive të nënshkrimit

Ura publike që furnizon kartat *"Ku të nënshkruani"* te `referendum21.org`.
Ndërtuar sipas të njëjtit model si [`functions/api/count.js`](functions/api/count.js).

---

## Skedarët

| Skedar | Roli |
|---|---|
| `sql/public-signing-points.sql` | pamja `public_signing_points` — burimi i vetëm, aplikohet një herë në Supabase |
| `functions/api/_origins.js` | allowlist-i i Origin-eve, i përbashkët |
| `functions/api/points.js` | endpointi |
| `vite.config.ts` | plugin `dev-api-points` që pasqyron endpointin te `npm run dev` |
| `tests/bridge/points-origin-cors.test.mjs` | Suita 6 — Origin, CORS, gabimet upstream |
| `tests/bridge/points-zero-pii.test.mjs` | Suita 7 — kontrata zero-PII e daljes |

---

## Vendosja

```bash
# 1. Apliko pamjen (SQL Editor te Supabase, ose psql)
psql "$SUPABASE_DB_URL" --set=ON_ERROR_STOP=1 --single-transaction \
  --file=sql/public-signing-points.sql

# 2. Prova lokale
npm run dev
curl -s http://localhost:3000/api/points | jq

# 3. Prova si në prodhim (motori i vërtetë i Pages Functions)
npm run build && npm run pages:dev
curl -s -H 'Origin: https://referendum21.org' http://localhost:8788/api/points | jq
```

Nuk kërkon variabla të reja mjedisi — përdor `SUPABASE_URL` dhe `SUPABASE_ANON_KEY`
që endpointi `/api/count` ka tashmë.

---

## Përgjigjja

```json
{
  "points": [
    {
      "id": "2679c2dd1c7da7ee",
      "unit_code": "A1",
      "unit_name": "Bulevardi",
      "point_name": "Sheshi Skënderbej",
      "city": "Tiranë",
      "lat": 41.328,
      "lng": 19.819,
      "opens_at": "2026-08-18T14:02:20.251Z",
      "closes_at": "2026-08-18T18:02:20.251Z"
    }
  ],
  "count": 1,
  "generated_at": "2026-08-18T14:30:00.000Z"
}
```

Lidhja me kartën në dizajn:

| Elementi i kartës | Fusha |
|---|---|
| Titulli — *"Sheshi"* | `unit_name` (ose `point_name`) |
| Nëntitulli — *"Sheshi Skënderbej, Tiranë"* | `point_name` + `city` |
| Çipi i orarit — *"10:00 – 20:00"* | `opens_at` – `closes_at` |
| Pin-i në hartë, *"Merr drejtimet"*, *"Hap në Maps"* | `lat`, `lng` |
| *"Gjej pikën më të afërt"* | `lat`/`lng` + Geolocation te shfletuesi |
| `key` te React | `id` |

### Kodet e gabimit

| Status | `error` | Kur |
|---|---|---|
| 403 | `forbidden_origin` | Origin jashtë allowlist-it |
| 503 | `service_misconfigured` | mungon `SUPABASE_URL`/`SUPABASE_ANON_KEY` |
| 502 | `upstream_unavailable` | Supabase u përgjigj me gabim |
| 504 | `gateway_timeout_or_error` | Supabase kaloi 4000 ms |

Kur nuk ka asnjë pikë aktive kthehet **200** me `points: []` — jo gabim. Faqja
pritëse duhet të shfaqë një mesazh bosh, nuk duhet të trajtojë si dështim.

---

## Siguria

### Çfarë NUK del nga endpointi

Zero e dhënë personale. Jo emër vullnetari, jo `volunteer_code`, jo foto,
telefon, email, `volunteer_id`, `checkin_id`, jo numër nënshkrimesh, dhe **jo
numër vullnetarësh në pikë**. Ky i fundit është vendim i qëllimshëm: për një
fushatë politike numri i personave në një stendë është informacion operativ —
tregon publikisht sa dobët mbulohet një pikë në një moment të dhënë.

### Shtresat

1. **Pamja si e vetmja dritare.** `anon` nuk ka asnjë leje mbi `checkins`,
   `shifts`, `units`, `volunteers` — e verifikuar në Postgres 16:
   të katërta kthejnë `permission denied`. Vetëm `public_signing_points` është
   `grant select ... to anon`.

2. **Agregim, nuk është gjurmim.** Rreshtat grupohen sipas *(njësi, pikë, qytet)*
   dhe koordinatat mesatarizohen. Pesë vullnetarë në një stendë = **një** rresht,
   i palidhur nga secili prej tyre.

3. **Precizion i ulur.** Koordinatat rrumbullakosen në 3 dhjetore (~110 m) —
   dy herë: në SQL dhe përsëri te endpointi. Mjafton për të navigosh te qoshja e
   duhur; nuk mjafton për të pikasur një person mbi trotuar.

4. **Skadim automatik.** `now() < s.ends_at` te pamja: një check-in i lënë hapur
   sepse udhëheqësi harroi ta mbyllte **nuk** e mban kartën gjallë përjetë.
   Dështimi shkon nga ana e sigurt — pika zhduket, jo mbetet fantazmë.

5. **Allowlist i fushave, nuk është blocklist.** Përgjigjja ndërtohet fushë pas
   fushe nga zero — pa `spread`, pa `delete`. Nëse dikush shton nesër një kolonë
   të ndjeshme te pamja, ajo **nuk** kalon te dalja, edhe pa e lexuar këtë skedar.
   Suita 7 e vërteton duke injektuar 11 kolona të ndjeshme upstream.

6. **Sanitizim i tekstit të pabesuar.** `point_name` vjen nga fusha *"Pika e
   saktë"* që shkruan vullnetari te check-in-i, ose nga `shifts.notes`. Pra tekst
   i shkruar nga njeriu, që renderohet në një domain tjetër. Hiqen karakteret e
   kontrollit dhe `<` `>`, bashkohen hapësirat, pritet gjatësia.
   **Faqja pritëse duhet gjithsesi t'i shpëtojë (escape) — kjo nuk e zëvendëson.**

7. **Kapak në numër.** Maksimumi 200 pika, i zbatuar te PostgREST (`limit`) dhe
   përsëri te endpointi.

8. **CORS per-origin, kurrë `*`.** `Access-Control-Allow-Origin` kthehet me
   origin-in e kërkesës dhe `Vary: Origin` mban cache-in e ndarë. Mbi HIT të
   cache-it header-i rishkruhet, që një përgjigje e ruajtur për një domain të
   mos i shërbehet një tjetri.

9. **Origin-i kontrollohet PARA upstream-it.** Një origin i huaj marr 403 pa që
   Supabase të merret fare — e testuar eksplicitisht.

10. **Çelësi nuk rrjedh.** `SUPABASE_ANON_KEY` nuk shfaqet as në trup, as në
    header — testuar.

### Ç'mbetet për ta shtuar

**Rate limiting.** Cloudflare Pages Functions nuk ka numërues të besueshëm pa
KV ose Durable Objects. Cache-i i skajit e mbron *upstream*-in (një kërkesë Supabase
për colo për 60 s), por nuk e mbron endpointin nga një përmbytje kërkesash. Shtoje
te dashboard-i, nuk ka kod:

> **Security → WAF → Rate limiting rules** → path `/api/points`, 60 kërkesa /
> minutë / IP, action *Managed Challenge*.

Të njëjtën rregull ia vlen t'ia shtoni edhe `/api/count`, që e ka po atë boshllëk.

**CSP te faqja pritëse.** `referendum21.org` duhet të lejojë thirrjen:

```
connect-src 'self' https://portal.referendum21.org;
```

---

## Pse polling dhe jo push

Kërkesa fillestare ishte që faqja pritëse të thirret **automatikisht sapo bëhet
një check-in**. Për një faqe statike kjo nuk bëhet dot me push, dhe arsyeja është
strukturore, nuk është zgjedhje:

- **Supabase Realtime** — do të kërkonte `anon key` te faqja pritëse, dhe RLS-ja
  e `checkins` lejon vetëm vullnetarë të miratuar. Vizitori anonim do të marrë
  zero eventë. Nuk funksionon.
- **Webhook** — kërkon një backend te faqja pritëse që të pranojë thirrjen. Faqja
  është statike.
- **Polling** — funksionon me hosting statik, është cache-friendly, dhe një
  vizitor nuk mund të detyrojë trafik shtesë drejt Supabase-it sepse cache-i i
  skajit e absorbon.

Me `max-age=60`, një check-in i re shfaqet te kartat brenda një minute. Ul
`CACHE_TTL_SECONDS` te `points.js` nëse duhet më shpejt — kujto se e ul edhe
mbrojtjen që cache-i i jep upstream-it.

---

## Kodi shembull për faqen pritëse

```js
const PORTAL = 'https://portal.referendum21.org';
const REFRESH_MS = 60_000;

async function fetchPoints() {
  const res = await fetch(`${PORTAL}/api/points`, {
    // Pa kredenciale: endpointi nuk i pranon dhe nuk i duhen.
    credentials: 'omit',
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`points ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.points) ? data.points : [];
}

// Distanca haversine, per "Gjej piken me te afert" -- llogaritet te klienti,
// qe vendndodhja e vizitorit te mos i dergohet kurre serverit.
function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
    : null;

function scheduleLabel(p) {
  const from = fmtTime(p.opens_at);
  const to = fmtTime(p.closes_at);
  return from && to ? `Hapur tani, ${from} – ${to}` : 'Hapur tani';
}

// Adresa e kartes. `point_name` dhe `city` jane tekst i shkruar nga njeriu:
// vendosi me textContent, KURRE me innerHTML.
const addressLine = (p) => [p.point_name, p.city].filter(Boolean).join(', ');

const directionsUrl = (p) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
const mapsUrl = (p) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;

async function render() {
  const points = await fetchPoints();
  const list = document.getElementById('points');
  list.textContent = '';

  if (!points.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Për momentin nuk ka pikë aktive. Provoni më vonë.';
    list.append(empty);
    return;
  }

  for (const p of points) {
    const card = document.createElement('article');
    card.className = 'point-card';
    card.dataset.id = p.id;

    const title = document.createElement('h3');
    title.textContent = p.unit_name || p.point_name;

    const address = document.createElement('p');
    address.textContent = addressLine(p);

    const hours = document.createElement('span');
    hours.className = 'chip';
    hours.textContent = scheduleLabel(p);

    const directions = document.createElement('a');
    directions.href = directionsUrl(p);
    directions.rel = 'noopener';
    directions.target = '_blank';
    directions.textContent = 'Merr drejtimet';

    const maps = document.createElement('a');
    maps.href = mapsUrl(p);
    maps.rel = 'noopener';
    maps.target = '_blank';
    maps.textContent = 'Hap në Maps';

    card.append(title, address, hours, directions, maps);
    list.append(card);
  }
}

render();
setInterval(render, REFRESH_MS);
```

---

## Testet

```bash
npm run test:bridge     # 7 suita, 64 teste
npm test                # + typecheck
```

Suita 6 dhe 7 janë të reja. Të gjitha kalojnë; suitat 1–5 ekzistuese mbeten të
paprekura sepse `count.js` nuk u modifikua.

Kur t'ia vlejë, `count.js` mund t'i marrë `isOriginAllowed` / `getCorsHeaders`
nga `_origins.js` në vend të kopjeve të vetat — mban një allowlist të vetëm.
Duhet bërë me kujdes: testet ekzistuese i importojnë nga `count.js`, ndaj ai
duhet t'i re-eksportojë.
