# Portali i vullnetarëve — udhëzues

Faqja që përdorin vullnetarët që mbledhin **50,000 nënshkrimet** për referendumin.
Ndryshe nga platforma publike "Për Shqipërinë", kjo **ka login** dhe hyjnë vetëm
njerëz të miratuar nga qendra.

Çfarë bën:

| Skeda | Për çfarë shërben |
|---|---|
| **Hyrje** | Progresi drejt 50,000, sa firma ke mbledhur ti, kush është në terren, ecuria e njësive |
| **Njoftime** | Njoftimet e rëndësishme (normal / e rëndësishme / urgjente, me fiksim lart) |
| **Terreni** | Check-in te një **njësi e hapur**, check-out me numrin e firmave, harta e mbledhësve aktivë |
| **Orari** | Turnet e planifikuara (e martë 18:00–20:00, njësia A1) dhe regjistrimi në to |
| **Materiale** | Guide-book, fletë-palosje, formularë, FAQ, dokumente ligjore |
| **Raportimet** | Incident · shqetësim ligjor · material i humbur |
| **Karta ime** | Foto-ID me QR që qytetari e skanon dhe verifikon vullnetarin |
| **Paneli** | (koordinatorë/admin) struktura, miratimi i vullnetarëve, njësitë, parametrat |
| **Historiku** | (vetëm admin) sa firma mblodhi çdo njësi, turn pas turni, me korrigjim |

Struktura ndjek organigramën e fushatës:

- **Shtresa 1 · Qendra** → rolet `Qendra (admin)` dhe `Jurist`
- **Shtresa 2 · Koordinatorët** → roli `Koordinator`, secili mban 2–4 zona
- **Shtresa 3 · Njësitë (zonat)** → `Mbledhës i autorizuar` + `Ndihmës`

Një koordinator mban disa zona (A1, A2…) dhe sheh **vetëm** njerëzit e tyre.
Qendra i sheh të gjithë. Kjo ndarje nuk është vetëm në pamje — është e mbyllur
edhe në bazën e të dhënave, ndaj s'kapërcehet dot duke luajtur me shfletuesin.

---

## 1. Hapni një projekt Supabase **të ri**

⚠️ **Mos e përdorni të njëjtin projekt** me platformën publike "Për Shqipërinë".
Dy arsye:

1. Këtu ruhen të dhëna personale — foto, telefon, kontakt urgjence, vendndodhje.
2. Skedari `supabase-schema.sql` i platformës publike bën `drop ... cascade`, që do
   të prishte politikat e sigurisë këtu nëse e rifreskoni ndonjëherë.

Shkoni te <https://supabase.com> → **New project**. Mbani shënim fjalëkalimin e bazës.

## 2. Ngarkoni skemën

Supabase → **SQL Editor → New query** → hapni `schema.sql`, kopjoni **gjithçka**,
ngjiteni, **Run**. Duhet të shihni "Success".

Skedari është i sigurt të rilexohet: krijon vetëm çka mungon dhe **nuk fshin të dhëna**.

## 3. Vendosni çelësat te `index.html`

Supabase → **Project Settings → API**. Kopjoni **Project URL** dhe çelësin **anon
public**, pastaj hapni `index.html` dhe zëvendësoni dy rreshtat në krye:

```js
const SUPABASE_URL      = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

Çelësi `anon` është publik me qëllim — mbrojtja bëhet nga rregullat e sigurisë
(RLS) në `schema.sql`, jo nga fshehja e çelësit.

## 4. Fikni konfirmimin me email (rekomandohet)

Supabase → **Authentication → Sign In / Providers → Email** → hiqni **Confirm email**.

Arsyeja: llogaritë miratohen gjithsesi me dorë nga qendra, ndaj konfirmimi me email
shton vetëm një hap ku vullnetarët ngecin. Nëse e lini të ndezur, portali e trajton —
u thotë të kontrollojnë email-in.

## 5. Bëni veten admin

1. Hapni portalin dhe **regjistrohuni** me email-in tuaj.
2. Kthehuni te **SQL Editor** dhe ekzekutoni (me email-in tuaj):

```sql
update public.volunteers
   set role = 'admin', status = 'approved', approved_at = now()
 where id = (select id from auth.users where email = 'ju@shembull.com');
```

3. Rifreskoni faqen — tani shihni skedat **Paneli** dhe **Historiku**.

Që andej, te **Paneli**:

1. Krijoni njësitë/zonat (A1, A2, B1…).
2. Caktoni një **koordinator** për secilën zonë (kolona *Koordinatori*).
   Personi duhet të ketë rolin `Koordinator`.
3. Miratoni vullnetarët dhe caktojini në një zonë.
4. **Hapni** zonat ku po mblidhen firma sot (butoni *E mbyllur → E hapur*).

## 7. Njësitë e hapura — pse ka rëndësi

Vullnetarët **nuk bëjnë dot check-in kudo**. Ata zgjedhin një nga njësitë që i ka
hapur qendra. Kush s'është hapur, nuk pranon firma — as duke ndryshuar kërkesat
nga shfletuesi, sepse kontrolli rri në bazë të dhënash.

Praktikisht: hapni zonat në mëngjes, mbyllini kur mbaron dita. Nëse asnjë njësi
nuk është e hapur, te **Terreni** vullnetari sheh një mesazh që ta pyesë
koordinatorin — jo një formular që s'punon.

> **Kujdes te ngarkimi i parë:** njësitë që i kishit **para** këtij ndryshimi
> hapen automatikisht, që fushata të mos ndalet në mes. Njësitë e reja nisin të
> mbyllura. Nëse doni t'i mbyllni të gjitha menjëherë, bëjeni nga Paneli.

## 8. Harta e terrenit

Në fund të skedës **Terreni** ka një hartë me mbledhësit që janë në terren tani.
Pika del vetëm nëse vullnetari e lejoi GPS-in kur bëri check-in — nëse e refuzoi,
turni numërohet normalisht, thjesht nuk shfaqet në hartë.

Harta nuk përdor asnjë bibliotekë të jashtme: pllakat vijnë nga OpenStreetMap si
figura të thjeshta. Pa internet, harta rri bosh por lista "Në terren tani" mbi të
punon njësoj.

## 9. Turnet (skeda *Orari*)

Koordinatori planifikon turne për **zonat e veta**, qendra për të gjitha:
zgjidhni njësinë, datën, orën nga–deri dhe sa veta duhen (`0` = pa kufi).
Vullnetarët regjistrohen vetë. Kur vendet mbushen, butoni bëhet *Plot*.

## 6. Publikimi automatik nga GitHub në Netlify

Repoja është gati për t'u publikuar drejtpërdrejt nga GitHub. Te Netlify:

1. Hapni **Add new project → Import an existing project → GitHub**.
2. Zgjidhni repon `diasporaforalbania/ref-volunteer-portal`.
3. Vendosni branch-in `main`. Lëreni **Build command** bosh dhe vendosni
   **Publish directory** `.` (këto lexohen edhe nga `netlify.toml`).
4. Nëse krijohet një site i ri, caktoni domenin ekzistues
   `pershqiperine.netlify.app` te site-i i lidhur me GitHub. Më mirë, lidhni
   repon me site-in ekzistues te **Build & deploy → Continuous deployment**.

Pas këtij konfigurimi një herë, çdo `push`/merge në `main` publikon automatikisht
`index.html`, `lib/` dhe skedarët e tjerë. Mos përdorni më Netlify Drop për këtë
site, sepse ai nuk ndjek ndryshimet në GitHub.

> **Kujdes:** `SUPABASE_ANON_KEY` në `index.html` është publik me qëllim. Mos
> vendosni kurrë aty database password, `service_role` key ose connection string.

## 6a. Përditësimi automatik i skemës Supabase nga GitHub

Workflow-i `.github/workflows/deploy-supabase-schema.yml` ekzekuton `schema.sql`
kur ai ndryshon në branch-in `main`. Për ta aktivizuar:

1. Supabase → **Project Settings → Database → Connection string** dhe kopjoni
   URI-n e **Session pooler**. Zëvendësoni `[YOUR-PASSWORD]` me fjalëkalimin e
   database-it. Session pooler punon edhe kur GitHub runner nuk ka IPv6.
2. GitHub repo → **Settings → Environments → New environment** → krijoni
   `production`.
3. Brenda environment-it `production`, shtoni secret me emrin e saktë
   `SUPABASE_DB_URL` dhe vlerën e URI-së së plotë.
4. GitHub → **Actions → Deploy Supabase schema → Run workflow** për provën e
   parë. Më pas ai ekzekutohet vetë vetëm kur ndryshon `schema.sql`.

Ndryshimet në HTML/JavaScript nuk ndryshojnë database-in: ato i publikon
Netlify. Vetëm ndryshimet SQL në `schema.sql` aplikohen në Supabase. Skedari
duhet të mbetet i sigurt për t'u ekzekutuar përsëri; ndryshimet që fshijnë ose
riemërtojnë kolona/tabela duhen shkruar si migrime të kujdesshme.

Dosja duhet të publikohet e plotë — sidomos `lib/`, ku rrinë dy bibliotekat.

> **Pse `lib/` dhe jo CDN:** bibliotekat (Supabase dhe gjeneruesi i QR-it) janë
> brenda dosjes me qëllim. Nëse një CDN bllokohet ose interneti është i dobët në
> terren, portali dhe QR-i i kartës punojnë gjithsesi. Mos i fshini.

---

## Si funksionon karta me foto

Çdo vullnetar merr automatikisht një kod (`V-0001`, `V-0002`, …). Te **Karta ime**
ngarkon një portret dhe merr një kartë me foto, emër, rol, njësi dhe **QR**.

QR-i çon te `faqja-juaj/?v=V-0001` — një faqe **publike** që tregon vetëm:
foton, emrin, kodin, rolin, njësinë, qytetin dhe nëse karta është aktive.
Telefoni, email-i dhe çdo e dhënë tjetër **nuk dalin kurrë** aty.

Kështu qytetari që jep nënshkrimin e verifikon në vend se personi është i vërtetë.
Kartën mund ta printoni (butoni **Printo kartën**).

## Kush sheh çfarë

| Të dhënat | Kush i sheh |
|---|---|
| Telefoni, kontakti i urgjencës | Vetëm vetë personi + qendra. Koordinatori vetëm për njerëzit e **zonave të veta** |
| Kartela e plotë e një vullnetari | Vetë personi + qendra. Koordinatori vetëm të vetët, plus ata në pritje/pa zonë (që t'i miratojë) |
| Emri, fotoja, njësia në terren | Të gjithë të miratuarit — por vetëm si listë "kush është në terren" dhe si pika në hartë, jo si kartelë e plotë |
| Raportimet | Vetëm autori + qendra/koordinatorët |
| Fotot e raportimeve | Njësoj — ruhen në një kovë **private**, me linqe që skadojnë për 5 minuta |
| Check-in-et | Të gjithë vullnetarët e miratuar (që të shihet mbulimi i terrenit) |
| Historiku i njësive | **Vetëm qendra (admin)** |
| Materialet, njoftimet | Të gjithë të miratuarit (njoftimet "interne" vetëm qendra) |

Rolin, statusin, zonën, hapjen e njësisë dhe historikun **nuk i ndryshon dot
askush nga faqja** — vetëm përmes funksioneve me kontroll roli në bazën e të
dhënave. Edhe nëse dikush luan me kërkesat në shfletues, nuk bëhet dot vetë
admin, nuk hap dot një njësi, dhe një koordinator nuk shikon dot zonat e tjetrit.

## Rregullimet e zakonshme

**Ndryshimi i objektivit ose afatit** — Paneli → *Parametrat e fushatës* (vetëm admin).

**Ndalimi i regjistrimeve të reja** — Supabase → Authentication → Providers → Email →
fikni **Enable sign up**. Llogaritë e krijoni ju te Authentication → Users.

**Dikush largohet nga fushata** — Paneli → *Pezullo*. Karta e tij bie menjëherë nga
verifikimi publik.

**Numrat e firmave** mblidhen nga check-out-et. Nëse dikush harron të mbyllë turnin,
turni rri "hapur" dhe nuk numërohet derisa ta mbyllë (ose ta anulojë). Te
**Historiku** këto turne dalin me shenjën *pa mbyllur* — mund t'ua vendosni vetë
orën e mbarimit dhe numrin e firmave.

**Dikush shkroi numër të gabuar firmash** — Historiku → *Ndrysho*. Ndryshimi
prek menjëherë edhe shifrën e përgjithshme të fushatës.

**"Nuk më lë të bëj check-in"** — ka shumë gjasa që asnjë njësi s'është e hapur,
ose është mbyllur ndërkohë. Paneli → njësitë → hapeni atë që duhet.

**Një koordinator nuk i sheh njerëzit e vet** — kontrolloni te Paneli që zonat
e tij ta kenë atë si *Koordinator*, dhe që vullnetarët të jenë caktuar në ato zona.

**Shkarkimi i të dhënave** — Historiku → *CSV*. Merr filtrin që keni vendosur
(njësi, datat) dhe i shkruan orët si orë lokale, jo UTC.
