# Phone notifications (Njoftimet & Raportimet)

Volunteers who install the portal on their phone can get a push notification
when the centre publishes an **announcement** (Njoftime) or when someone files a
**report** (Raportimet — staff only).

Until steps 2–4 below are done, nothing breaks: the portal simply doesn't offer
notifications, and no card appears on the Paneli page.

---

## How this repo deploys

| Part | How it gets deployed |
|---|---|
| `index.html`, `sw.js`, `manifest.webmanifest`, icons | **automatic** — pushing to `main` redeploys Netlify |
| `schema.sql` | **you, by hand** in the Supabase SQL Editor |
| `supabase/functions/send-push/` | **you, by hand** in the Supabase dashboard |

So: pushing to GitHub gets the phone-app half live. The database half and the
sender have to be done in Supabase yourself. Steps 3 and 4 below are the
Supabase side.

> There is a `.github/workflows/deploy-supabase-schema.yml` in this repo that
> would apply `schema.sql` automatically if a `SUPABASE_DB_URL` secret were set.
> Since you apply the schema yourself, that workflow is redundant — if it's been
> emailing you failed-run notices, it can be deleted safely. Nothing else uses it.

---

## What was added

| File | What it does |
|---|---|
| `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` | makes the portal installable as an app |
| `badge-96.png` | the small monochrome mark Android puts in the status bar |
| `sw.js` | service worker — receives the push and shows the notification |
| `supabase/functions/send-push/index.ts` | the only thing that can actually send a push |
| `push_subscriptions` table + `push_subscribe` / `push_unsubscribe` in `schema.sql` | one row per phone that opted in |

The private key never leaves Supabase. The portal only ever holds the **public**
half, which is safe to publish.

---

## Setup (once)

### 1. Generate the key pair

No install needed. Open the portal in Chrome (or any desktop browser), press
**F12** → **Console**, paste this and press Enter:

```js
(async () => {
  const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)))
                    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const kp = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'}, true, ['sign','verify']);
  const pub  = b64(await crypto.subtle.exportKey('raw', kp.publicKey));
  const priv = (await crypto.subtle.exportKey('jwk', kp.privateKey)).d;
  console.log('PUBLIC :', pub);
  console.log('PRIVATE:', priv);
})();
```

It prints two lines. The public one is ~87 characters and starts with `B`; the
private one is ~43 characters.

**The public key is safe to commit. The private key is not — never put it in
this repo.** Keep it somewhere private until step 4.

*(If you'd rather use the command line and have Node installed,
`npx web-push generate-vapid-keys` produces the same thing.)*

### 2. Put the public key in the portal

In `index.html`, near the top, replace the placeholder:

```js
const VAPID_PUBLIC_KEY = "PASTE_VAPID_PUBLIC_KEY";
```

Commit and push. Netlify redeploys on its own.

### 3. Apply the schema in Supabase

Supabase → **SQL Editor** → **New query** → paste the whole of `schema.sql` → **Run**.

Same as you always do. It's safe to re-run; it adds the `push_subscriptions`
table and the two functions and touches nothing else.

### 4. Deploy the sender in Supabase

**a. Set the secrets.** Supabase → **Edge Functions** → **Secrets**
(also reachable at Project Settings → Edge Functions). Add three:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key from step 1 |
| `VAPID_PRIVATE_KEY` | the private key from step 1 |
| `VAPID_SUBJECT` | `mailto:` + a real contact address, e.g. `mailto:qendra@example.org` |

Don't add `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` — Supabase provides
those to the function automatically.

**b. Create the function.** Supabase → **Edge Functions** → **Deploy a new
function** → **via Editor**. Name it exactly:

```
send-push
```

Delete the sample code, paste the entire contents of
`supabase/functions/send-push/index.ts` from this repo, and deploy.

The name must match `send-push` — that's what the portal calls.

*(CLI alternative, if you ever want it: `supabase functions deploy send-push`.)*

### 5. Check it

Open the portal → **Paneli** → *Aktivizo njoftimet* → allow. Then publish a test
announcement from **Njoftime**. The notification should arrive within a second
or two.

---

## How volunteers turn it on

1. Install the portal on the phone:
   - **iPhone:** Safari → Share → *Add to Home Screen*, then open it from the icon.
   - **Android:** Chrome offers *Install app* / *Add to Home screen*.
2. Open **Paneli** → *Aktivizo njoftimet* → allow when the phone asks.

The same card turns them back off (*Çaktivizo*).

⚠️ **iPhone requires the install step.** Apple only allows web notifications from
a home-screen app (iOS 16.4+). Opened in plain Safari the option doesn't exist —
the portal detects this and shows the instructions instead of an error. Android
works either way.

Each phone opts in separately; the same person can enable it on several devices.

---

## Who receives what

| Event | Goes to |
|---|---|
| Announcement, "Të gjithë vullnetarët" | every approved volunteer who opted in |
| Announcement, "Vetëm qendra & koordinatorët" | koordinator, jurist, admin |
| New report | koordinator, jurist, admin |

The Edge Function re-reads the row from the database and decides the audience
itself — it doesn't trust whatever the browser sent it. Suspended accounts never
receive anything, and dead subscriptions (app uninstalled, permission revoked)
are deleted automatically the first time a send fails with 404/410.

---

## If notifications don't arrive

**Start with the test button.** Paneli → *Dërgo një provë* sends a push to your
own devices only. That splits the problem in two:

- **The test arrives, a real announcement doesn't** → the keys, the function and
  the phone are all fine. The problem is the audience: nobody in the chosen
  audience has notifications switched on.
- **The test fails too** → the failure message says why (it now shows the real
  reason from the function instead of failing silently).

Then the usual suspects:

- **No card on the Paneli page** → step 2 wasn't done (or wasn't deployed yet),
  or the browser has no push support.
- **"Njoftimet janë të bllokuara"** → the user tapped *Don't allow* once. It has
  to be re-allowed in the browser's site settings; the app can't ask again.
- **Card says "Aktivizo" but nothing arrives** → Supabase → Edge Functions →
  `send-push` → **Logs**. `VAPID keys not configured` means the step-4a secrets
  are missing or misspelled.
- **`Function not found`** → the function name isn't exactly `send-push`.
- **Nothing on iPhone** → confirm it was opened from the home-screen icon, not Safari.

---

## If you change `favicon.svg`

Every icon in the repo is generated from `favicon.svg` — it's the single source
of truth. After editing it, regenerate them (needs ImageMagick: `brew install imagemagick`):

```bash
magick -density 1200 -background none favicon.svg -resize 192x192 -depth 8 -strip icon-192.png
```

```bash
magick -density 1200 -background none favicon.svg -resize 512x512 -depth 8 -strip icon-512.png
```

```bash
magick -size 512x512 xc:'#102621' \( -density 1200 -background none favicon.svg -resize 368x368 \) -gravity center -composite -depth 8 -strip icon-maskable-512.png
```

```bash
magick -size 180x180 xc:'#102621' \( -density 1200 -background none favicon.svg -resize 180x180 \) -gravity center -composite -depth 8 -strip apple-touch-icon.png
```

Why they differ:

- **icon-192 / icon-512** — the SVG as-is, rounded corners and transparency kept.
- **icon-maskable-512** — Android crops icons to a circle or squircle. The
  background fills the whole square and the logo is scaled to 72% so nothing gets
  cut off.
- **apple-touch-icon** — iOS applies its own rounded mask and turns transparency
  **black**, so this one is flattened onto a solid background.
- **badge-96** — the letters only, white on transparent, because Android draws
  the status-bar badge as a flat silhouette. If the brand mark changes shape,
  redraw this by hand from the new paths.

If you change the background colour in the SVG, change `background_color` in
`manifest.webmanifest` to match — that colour is the splash screen behind the
icon while the app opens.

---

## Turning it off entirely

Set `VAPID_PUBLIC_KEY` back to `"PASTE_VAPID_PUBLIC_KEY"` in `index.html` and
push. The card disappears and no sends are attempted. Stored subscriptions stay
in the table, harmless, and start working again if you put the key back.
