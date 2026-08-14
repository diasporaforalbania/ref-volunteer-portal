---
title: "Struktura Organizative dhe Përshkrimi i Roleve"
subtitle: "Fushata për referendumin e shfuqizimit të ligjit 21/2024 — 50,000 nënshkrime"
author: "Dokument i brendshëm i fushatës"
date: "Gusht 2026"
lang: sq
toc: true
toc-depth: 3
numbersections: true
geometry: "a4paper,margin=2.2cm"
colorlinks: true
linkcolor: fushateal
urlcolor: fushateal
toccolor: fushadark
header-includes:
  - \definecolor{fushateal}{HTML}{0F766E}
  - \definecolor{fushadark}{HTML}{1F2937}
  - \usepackage{etoolbox}
  - \usepackage{longtable}
  - \AtBeginEnvironment{longtable}{\footnotesize}
  - \AtBeginEnvironment{verbatim}{\footnotesize}
  - \usepackage{fancyhdr}
  - \pagestyle{fancy}
  - \fancyhead[L]{\footnotesize Struktura dhe Rolet}
  - \fancyhead[R]{\footnotesize Referendum 21/2024}
  - \fancyfoot[C]{\thepage}
  - \renewcommand{\headrulewidth}{0.4pt}
---

\newpage

# Hyrje: pse ekziston ky dokument

Kjo fushatë ka një objektiv të vetëm, të matshëm dhe me afat: **50,000 nënshkrime
të vlefshme qytetarësh** për të kërkuar referendumin e shfuqizimit të ligjit
21/2024. Objektivi nuk arrihet me entuziazëm — arrihet me **strukturë**: me
njerëz që e dinë saktësisht se çfarë bëjnë, kujt i raportojnë, çfarë kanë të
drejtë të vendosin vetë dhe çfarë duhet ta ngjitin më lart.

Ky dokument është *kontrata e brendshme* e fushatës. Ai përshkruan:

1. **konceptin** e strukturës — pse është ndarë kështu dhe jo ndryshe;
2. **nëntë rolet** e fushatës, një nga një, me detyra, të drejta dhe kufij;
3. **matricën e të drejtave** — kush çfarë sheh dhe kush çfarë prek;
4. **rrjedhat e punës** — regjistrimi, turni, raportimi, ndryshimi i të dhënave;
5. **numrat** — çfarë ritmi kërkon kjo strukturë për të arritur 50,000.

> **E rëndësishme:** struktura e përshkruar këtu nuk është teori — pjesa më e
> madhe e saj është e koduar në portalin e vullnetarëve (`schema.sql` +
> `index.html`) dhe zbatohet nga baza e të dhënave, jo nga mirëbesimi. Nëse
> dikush "nuk arrin dot" të bëjë diçka, zakonisht nuk është defekt — është ky
> dokument që po zbatohet.

## Si të lexohet

- **Vullnetari i ri** lexon kapitujt 2, 4 (roli i vet) dhe 7.
- **Mbledhësi dhe koordinatori** lexojnë gjithçka deri te kapitulli 8.
- **Qendra** lexon të gjithë dokumentin, sidomos kapitujt 5 dhe 9.

\newpage

# Konceptet themelore

Para roleve, gjashtë koncepte. Pa këto, përshkrimet më poshtë nuk kuptohen.

## Tri shtresat

Fushata është ndarë në tri shtresa, sipas *distancës nga qytetari që nënshkruan*:

| Shtresa | Emri | Kush | Marrëdhënia me terrenin |
|---|---|---|---|
| 1 | **Qendra** | Admin, Jurist, Logjistikë, BNj, PR & Edukim, IT | Nuk del në terren. Mundëson. |
| 2 | **Koordinatorët** | Koordinator | Drejton terrenin, del në të kur duhet. |
| 3 | **Njësitë në terren** | Mbledhës i autorizuar, Ndihmës | *Është* terreni. Mbledh nënshkrimet. |

Ndarja nuk është hierarki nderi — është ndarje **funksioni dhe përgjegjësie
ligjore**. Qendra mban rrezikun ligjor dhe reputacional; terreni mban rezultatin.

## Njësia (zona) është ekipi

Në këtë fushatë **njësia dhe ekipi janë e njëjta gjë**. Kodi `A1` nuk emërton
një copë territori — emërton një **ekip** me përbërje të qartë:

- **një mbledhës i autorizuar**, dhe vetëm një, për çdo njësi;
- **ndihmësit** që punojnë nën atë mbledhës;
- një **koordinator** që mban 2–3 njësi të tilla (jo më shumë).

Prej kësaj rrjedhin dy rregulla që nuk kanë përjashtim:

1. **Një mbledhës i autorizuar i përket vetëm një njësie.** Zona A1 ka
   mbledhësin e vet, zona A2 ka një tjetër. Nuk ndahen dhe nuk mbivendosen.
2. **Territori mund të lëvizë; ekipi jo.** Nëse ekipi A1 sot punon te tregu
   dhe javën tjetër te stacioni i autobusëve, ai mbetet ekipi A1. Emri i
   njësisë është identiteti i ekipit, jo adresa e tij.

Kjo është arsyeja pse zona ka kod të shkurtër (`A1`, `B2`) dhe jo emër vendi:
kodi rri i njëjtë sado të lëvizë puna.

## Njësia e aktivizuar / e çaktivizuar

Një njësi (zonë) është ose **e aktivizuar** ose **e çaktivizuar** për mbledhje.
**Askush nuk bën check-in në një njësi të çaktivizuar.** Ky është çelësi kryesor
i sigurisë së fushatës: nëse shfaqet një problem ligjor te një ekip ose te një
territor, njësia çaktivizohet brenda sekondave dhe mbledhja aty ndalet
menjëherë, pa telefonata dhe pa diskutim.

Në punë normale merret e mirëqenë që **të gjitha njësitë janë të aktivizuara**.
Çaktivizimi është masë e jashtëzakonshme, jo hap i përditshëm i punës.

## Turni (`shift`) dhe check-in-i

- **Turni** është një bllok kohe i planifikuar në një zonë (p.sh. e martë,
  18:00–20:00, zona A1). E hap **vetëm** koordinatori (në zonat e veta) ose
  mbledhësi i autorizuar (në zonën e vet).
- Vullnetarët **regjistrohen** në turn paraprakisht.
- **Check-in** = "kam mbërritur, po nis punën". Hapet 15 minuta para fillimit.
- **Check-out** = mbyllja e turnit dhe **raportimi i numrit të nënshkrimeve**.
  Këtë e bën **vetëm udhëheqësi që e hapi turnin**, dhe numri raportohet
  **për gjithë ekipin njëherësh**.

Rregulli "raporton vetëm udhëheqësi" nuk është mosbesim ndaj vullnetarëve —
është mbrojtje nga numërimi i dyfishtë. Nëse pesë veta raportojnë secili "70
firma" për të njëjtat 70 fletë, fushata do të mendonte se ka 350.

## Statusi i llogarisë

Çdo llogari ka një nga tri statuset:

| Status | Kuptimi |
|---|---|
| `në pritje` | U regjistrua vetë. **Nuk sheh dhe nuk bën asgjë** derisa admini të vendosë. |
| `aktiv` | I miratuar. Ka të drejtat e rolit të vet. |
| `pezulluar` | I hequr nga qarkullimi pa u fshirë. Historiku i mbetet. |

## Roli i kërkuar ≠ roli i dhënë

Në regjistrim, personi *kërkon* një rol (dropdown-i i formularit). Kjo është
thjesht një **preferencë**. Roli real jepet me dorë nga **admini** në momentin e
miratimit. Askush nuk bëhet koordinator apo jurist duke zgjedhur një opsion në
formular. Roli `admin` nuk figuron as si opsion në formularin e regjistrimit.

\newpage

# Diagramet e strukturës

## Diagrami 1 — tri shtresat dhe rrjedha e vendimit

```
   ╔════════════════════════════════════════════════════════════════╗
   ║  SHTRESA 1  ·  QENDRA                                          ║
   ║  ------------------------------------------------------------  ║
   ║  Admin  ·  Jurist  ·  Logjistikë  ·  BNj  ·  PR  ·  IT         ║
   ║                                                                ║
   ║  Vendos · Mbron ligjërisht · Furnizon · Komunikon · Mirëmban   ║
   ║  NUK del në terren. NUK bën check-in. NUK planifikon turne.    ║
   ╚════════════════════════════════════════════════════════════════╝
              │                                        ▲
              │  vendime, materiale, mbrojtje          │  raportime,
              │  ligjore, njoftime, objektiva          │  incidente,
              ▼                                        │  numra
   ╔════════════════════════════════════════════════════════════════╗
   ║  SHTRESA 2  ·  KOORDINATORËT                                   ║
   ║  ------------------------------------------------------------  ║
   ║  Koordinatori mban 2–3 njësi. Planifikon turnet,               ║
   ║  cakton njerëzit, mbyll turnet, raporton firmat, zgjidh        ║
   ║  problemet e vogla në vend.                                    ║
   ╚════════════════════════════════════════════════════════════════╝
              │                                        ▲
              │  orari, detyrat, materialet            │  gjendja e
              │  e zonës, udhëzimet                    │  turnit
              ▼                                        │
   ╔════════════════════════════════════════════════════════════════╗
   ║  SHTRESA 3  ·  NJËSITË NË TERREN                               ║
   ║  ------------------------------------------------------------  ║
   ║  Mbledhësi i autorizuar  →  Ndihmësit                          ║
   ║  Këtu, dhe vetëm këtu, mblidhen 50,000 nënshkrimet.            ║
   ╚════════════════════════════════════════════════════════════════╝
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    QYTETARI     │
                        │  që nënshkruan  │
                        └─────────────────┘
```

\newpage

## Diagrami 2 — pema e raportimit (organigrama)

```
                          ┌────────────────────┐
                          │      QENDRA        │
                          │  ────────────────  │
                          │  Admin        (5)  │
                          │  Jurist       (3)  │
                          │  Logjistikë   (5)  │
                          │  BNj          (5)  │
                          │  PR & Edukim  (6)  │
                          │  IT           (5)  │
                          └─────────┬──────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
   ┌──────┴───────┐         ┌───────┴──────┐          ┌───────┴──────┐
   │ KOORDINATOR  │         │ KOORDINATOR  │          │ KOORDINATOR  │
   │  zonat A1–A3 │         │  zonat B1–B2 │          │  zonat C1–C3 │
   └──────┬───────┘         └──────────────┘          └──────────────┘
          │
   ┌──────┴───────┬───────────────┐
   │              │               │
┌──┴────────┐ ┌───┴───────┐ ┌─────┴─────┐
│ ZONA A1   │ │ ZONA A2   │ │ ZONA A3   │
│ ───────── │ │ ───────── │ │ ───────── │
│ MBLEDHËS  │ │ MBLEDHËS  │ │ MBLEDHËS  │
│ i autoriz.│ │ i autoriz.│ │ i autoriz.│
└──┬────────┘ └───────────┘ └───────────┘
   │
   ├──────────┬──────────┬──────────┐
   │          │          │          │
┌──┴────┐ ┌───┴───┐ ┌────┴──┐ ┌─────┴─┐
│Ndihmës│ │Ndihmës│ │Ndihmës│ │Ndihmës│
└───────┘ └───────┘ └───────┘ └───────┘

   Rregull i fortë:  një njësi = një mbledhës i autorizuar, gjithmonë.
                     një koordinator = 2–3 njësi, jo më shumë.
                     mbledhësi ka supervizor VETËM koordinator.
                     ndihmësi  ka supervizor VETËM mbledhës.
                     Çdo kombinim tjetër refuzohet nga sistemi.
```

\newpage

## Diagrami 3 — cikli i jetës së një turni

```
  KOORDINATOR / MBLEDHËS                        VULLNETARËT
  ──────────────────────                        ───────────

  ┌───────────────────┐
  │ 1. HAP TURNIN     │
  │ zona, data, ora,  │
  │ kapaciteti, shënim│
  └─────────┬─────────┘
            │  njoftim në telefon
            └───────────────────────────┐
                                        ▼
                              ┌────────────────────┐
                              │ 2. REGJISTROHEN    │
                              │ në turn (paraprak) │
                              └─────────┬──────────┘
                                        │
                         ── 15 min para fillimit ──
                                        ▼
                              ┌────────────────────┐
                              │ 3. CHECK-IN        │
                              │ + vendndodhja      │
                              └─────────┬──────────┘
                                        │
                              ┌─────────┴──────────┐
                              │ 4. MBLEDHJA        │
                              │ e nënshkrimeve     │
                              └─────────┬──────────┘
  ┌───────────────────┐                 │
  │ 5. CHECK-OUT      │◄────────────────┘
  │ raporton FIRMAT   │  turni mbyllet për të gjithë njëherësh
  │ e gjithë ekipit   │
  └─────────┬─────────┘
            │
            ▼
  ┌───────────────────────────────────────────────────────────┐
  │  Numri shkon te "Progresi i fushatës" — një herë të vetme │
  └───────────────────────────────────────────────────────────┘
```

\newpage

## Diagrami 4 — nga regjistrimi te terreni

```
   ┌──────────────┐
   │  Regjistrohet│  emri, qyteti, telefoni, roli i KËRKUAR
   │  vetë online │
   └──────┬───────┘
          │  status: NË PRITJE  ·  rol: ndihmës  ·  nuk sheh asgjë
          ▼
   ┌──────────────────────────────────────┐
   │  ADMINI shqyrton (faqja "Admin")     │
   │  • verifikon identitetin             │
   │  • jep ROLIN real                    │
   │  • mirato ose refuzo                 │
   └──────┬────────────────────┬──────────┘
          │ miratuar           │ refuzuar
          ▼                    ▼
   ┌──────────────┐     ┌──────────────┐
   │ status: AKTIV│     │  PEZULLUAR   │
   └──────┬───────┘     └──────────────┘
          │
          ├──► ngarkon FOTON (një herë të vetme, pastaj vetëm me kërkesë)
          │
          ├──► ADMINI/KOORDINATORI cakton NJËSINË (zonën)
          │
          ├──► ADMINI/KOORDINATORI cakton SUPERVIZORIN
          │
          ▼
   ┌──────────────────────────────────────┐
   │  KARTA IME → QR → verifikim publik   │
   │  Gati për turnin e parë              │
   └──────────────────────────────────────┘
```

\newpage

# Përshkrimi i roleve

Nëntë role, të grupuara në tri shtresa. Për secilin: koncepti, përgjegjësitë,
detyrat konkrete, të drejtat në portal, kufijtë (çfarë **nuk** bën) dhe profili
i përshtatshëm.

---

## Ndihmës — `ndihmes`

**Shtresa:** 3 (terren) · **Raporton te:** një Mbledhës i autorizuar ·
**Nën vete:** askush · **Numri i pritur:** 100 persona (4 për çdo njësi)

### Koncepti

Ndihmësi është *muskuli i fushatës* dhe roli hyrës për këdo. Çdo person i ri
nis këtu, pavarësisht CV-së. Arsyeja është e thjeshtë: mbledhja e nënshkrimeve
është një zanat që mësohet vetëm në rrugë — si t'i flasësh një kalimtari të
nxituar, si ta shpjegosh ligjin 21/2024 në dyzet sekonda, si ta njohësh
momentin kur duhet të tërhiqesh. Askush nuk e drejton dot një ekip pa i bërë
vetë njëqind bisedime të tilla.

Ndihmësi **nuk është** thjesht "ai që mban fletët". Ai është fytyra e parë e
fushatës për qytetarin — dhe në një fushatë referendumi, besueshmëria fitohet
ose humbet në atë takim tridhjetësekondësh.

### Përgjegjësitë kryesore

- Të flasë me qytetarët, të shpjegojë qëllimin e referendumit dhe të ftojë
  për nënshkrim, gjithmonë me **gjuhë të qetë dhe të vërtetë**.
- Të mbajë materialet e turnit në rregull: fletë-palosje, formularë, stilolapsa.
- Të ndihmojë mbledhësin e autorizuar në çdo detyrë praktike të turnit:
  vendosja e tavolinës, orientimi i njerëzve, radha, mbyllja e vendit.
- Të njoftojë **menjëherë** mbledhësin për çdo pengesë, presion ose konflikt.
- Të mbrojë të dhënat e qytetarëve: formularët e nënshkruar nuk lihen kurrë pa
  mbikëqyrje, nuk fotografohen dhe nuk ndahen me askënd jashtë ekipit.

### Detyra konkrete

| Kur | Çfarë |
|---|---|
| Para turnit | Regjistrohet në turn te "Turni"; kontrollon orën dhe vendin. |
| Në mbërritje | Bën **check-in** (hapet 15 min para fillimit). |
| Gjatë turnit | Flet me qytetarët; mban rendin te tavolina; ndjek mbledhësin. |
| Në fund | Dorëzon materialet te mbledhësi. **Nuk raporton vetë numrin.** |
| Sipas rastit | Hap një **Raportim** për incident, shqetësim ligjor ose material të humbur. |

### Të drejtat në portal

- Sheh: Hyrje, Njoftime, Terreni, Turni, Materiale, Raportimet (vetëm të vetat),
  Karta ime, Paneli (vetëm dega e vet e strukturës).
- Bën: regjistrim në turn, check-in, raportim incidenti, kërkesë ndryshimi.
- Sheh nga struktura: **veten, mbledhësin e vet dhe koordinatorin e atij
  mbledhësi** — asgjë më shumë.

### Çfarë NUK bën

- Nuk hap turne dhe nuk raporton numrin e nënshkrimeve.
- Nuk mban formularë të nënshkruar jashtë turnit dhe nuk i çon në shtëpi.
- Nuk jep interpretime ligjore te qytetarët — dërgon pyetjen te mbledhësi.
- Nuk flet në emër të fushatës me media ose në rrjete sociale zyrtarisht.
- Nuk i ndryshon vetë të dhënat e profilit pasi janë plotësuar një herë.

### Profili

Nuk kërkohet përvojë. Kërkohet: **qëndrueshmëri në refuzim**, gjuhë e pastër,
respekt për njerëz që mendojnë ndryshe, dhe përpikëri me orën. Një person që
nuk mban dot durimin kur i thonë "jo" nuk duhet të jetë në terren.

---

\newpage

## Mbledhës i autorizuar — `mbledhes`

**Shtresa:** 3 (terren) · **Raporton te:** Koordinator ·
**Nën vete:** 4 Ndihmës · **Njësi:** një, dhe vetëm një ·
**Numri i pritur:** 25 persona (një për çdo njësi)

### Koncepti

Mbledhësi i autorizuar është **personi që sistemi e njeh si përgjegjës për
nënshkrimet**. Fjala "i autorizuar" nuk është dekor: ai është i trajnuar dhe i
emëruar zyrtarisht për të mbledhur nënshkrime — **autorizimin e jep Juristi** —
dhe numri që ai raporton bëhet numri zyrtar i fushatës për atë turn.

Ky është roli i parë me **përgjegjësi njerëzore dhe ligjore njëkohësisht**. Ai
drejton një ekip të vogël (vetja + 4 ndihmës) dhe është ura e vetme midis
terrenit dhe koordinatorit. Nëse mbledhësi është i dobët, koordinatori nuk e
merr vesh se një njësi po dështon derisa të jetë vonë.

**Mbledhësi dhe njësia janë një.** Ai nuk është "caktuar" në zonën A1 — ai
**është** zona A1. Çdo njësi ka një mbledhës të vetëm, dhe çdo mbledhës i
përket vetëm një njësie. Prandaj ai është **personi që vendos turnet** e
njësisë së vet: cakton ditët, orët dhe ekipin që del. Njësinë vetë nuk e krijon
dhe nuk e aktivizon apo çaktivizon — ajo është punë e Adminit.

### Përgjegjësitë kryesore

- **Të mbledhë nënshkrime** dhe të garantojë që çdo fletë është plotësuar
  saktë e plotësisht — një formular i keqplotësuar është një nënshkrim i humbur.
- **Të drejtojë ekipin e vet** gjatë turnit: ndarja e vendeve, rotacioni,
  pushimet, siguria.
- **Të hapë turne** në zonën e vet dhe të ftojë ekipin.
- **Të bëjë check-out dhe të raportojë numrin e nënshkrimeve** të gjithë ekipit.
  Ky është veprimi i tij më i rëndësishëm i ditës.
- **Të ruajë fizikisht formularët** nga momenti i nënshkrimit deri te dorëzimi
  te logjistika/koordinatori, sipas zinxhirit të kujdestarisë.
- **Të trajnojë ndihmësit** e vet: si të flasin, si të plotësohet formulari, çfarë
  të mos thuhet kurrë.

### Detyra konkrete

| Kur | Çfarë |
|---|---|
| Javore | Planifikon turnet e javës në zonën e vet; kontrollon stokun e formularëve. |
| Para turnit | Konfirmon që njësia është **e aktivizuar**; kontrollon kush u regjistrua. |
| Në turn | Check-in; ndan detyrat; mban rendin; zgjidh situatat e vogla. |
| Në fund | **Check-out me numrin real**; numëron fletët; shkruan shënim. |
| Pas turnit | Dorëzon formularët; njofton koordinatorin për çdo problem. |
| Vazhdimisht | Trajnon ndihmësit; propozon te koordinatori kush është gati për t'u ngritur. |

### Të drejtat në portal

- **Hap turne — vetëm në njësinë e vet** (`unit_id` i tij).
- **Mbyll turnin dhe raporton nënshkrimet** — vetëm turnet që hapi vetë.
- **Miraton vullnetarë të rinj për ekipin e vet — në marrëveshje me Adminin.**
  Vendimi merret bashkë; veprimi në portal kryhet nga Admini.
- Sheh nga struktura: **koordinatorin e vet, veten dhe ndihmësit e vet**.
- Sheh dhe hap raportime (të vetat); sheh materialet; sheh njoftimet publike.

### Çfarë NUK bën

- **Nuk hap turne në njësinë e një kolegu.** Sistemi e ndalon.
- Nuk mbyll turnin e dikujt tjetër — as të koordinatorit të vet.
- **Nuk krijon, nuk fshin dhe nuk aktivizon/çaktivizon njësi** — as të vetën,
  as të një mbledhësi tjetër. Këto i bën Admini (krijimin edhe koordinatori).
- Nuk cakton role. Rolin e jep vetëm Admini.
- Nuk raporton numra "të përafërt". Numri i raportuar duhet të jetë numri i
  fletëve të numëruara fizikisht.
- Nuk mban formularë të nënshkruar përtej afatit të dorëzimit.

### Profili

Përvojë e provuar në terren (zakonisht 10+ turne si ndihmës). Aftësi për të
mbajtur qetësinë në presion. Përpikëri numerike — ky rol prek numra që shkojnë
te totali zyrtar. I besueshëm me dokumente me të dhëna personale.

---

\newpage

## Koordinator — `koordinator`

**Shtresa:** 2 · **Raporton te:** Qendra (Admin) ·
**Nën vete:** 2–3 njësi, pra 2–3 Mbledhës + ekipet e tyre (8–12 ndihmës) ·
**Numri i pritur:** 10 persona

### Koncepti

Koordinatori është **drejtuesi operativ i 2–3 njësive**. Kufiri është i prerë:
**jo më shumë se tri njësi**. Ai përgjigjet për gjithçka që ndodh brenda tyre:
njerëzit, orari, numrat, dhe problemet. Nëse Qendra vendos *çfarë* bëhet,
koordinatori vendos *ku, kur dhe me kë*.

Ky është roli më i vështirë i fushatës, sepse është i vetmi që qëndron
njëkohësisht në dy botë: mban standardin dhe disiplinën e Qendrës, por punon me
vullnetarë që nuk paguhen dhe që mund të mos vijnë nesër. Koordinatori i mirë
nuk komandon — ai **e mban ekipin të dojë të vijë përsëri**.

Koordinatori nuk i përket asnjë njësie: ai **i mban** njësitë. Prandaj në sistem
ai nuk ka `unit_id`, por figuron si `coordinator_id` te njësitë e veta.

### Përgjegjësitë kryesore

- **Të planifikojë mbulimin e territorit**: cilat vende, cilat orë, sa ekipe.
  Një treg të shtunën në mëngjes nuk është njësoj si një rrugë zyrash të hënën.
- **Të organizojë njerëzit**: cakton mbledhësit, u shpërndan ndihmësit, mbush
  boshllëqet kur dikush nuk vjen.
- **Të ndjekë numrat çdo ditë** dhe të ndërhyjë kur një zonë ngec.
- **Të shqyrtojë raportimet** e ekipeve të veta dhe t'i zgjidhë ose t'i ngjitë
  te Qendra.
- **Të mbrojë vullnetarët**: askush nuk lihet vetëm në një situatë presioni.
- **Të propozojë ngritje** — kush prej ndihmësve është gati të bëhet mbledhës.
- **Të shkruajë njoftime** për ekipet e veta.

### Detyra konkrete

| Kur | Çfarë |
|---|---|
| Javore | Harton orarin e javës për të gjitha zonat e veta. |
| Javore | Takim i shkurtër me mbledhësit: numrat, pengesat, nevojat. |
| Ditore | Kontrollon "Terreni" — kush është jashtë tani; ndjek turnet e hapura. |
| Ditore | Shqyrton raportimet e reja; vendos: zgjidh vetë apo ngjit te Qendra. |
| Sipas nevojës | Cakton njësinë dhe supervizorin për vullnetarët e rinj të zonës. |
| Sipas nevojës | Hap vetë turne dhe del në terren — sidomos ku ekipi është i ri. |
| Mujore | Propozon te Admini ndryshime zonash, objektivash dhe ngritjesh. |

### Të drejtat në portal

- **Hap turne — vetëm në njësitë që mban.**
- **Mbyll turnet e veta** dhe raporton nënshkrimet e ekipit.
- **Krijon ose fshin njësi** brenda territorit të vet.
- **Cakton pragun e nënshkrimeve** për njësitë e veta.
- **Sheh vullnetarët e njësive të veta**, plus ata **në pritje** ose **pa njësi**
  (që të ketë kë të caktojë). Nuk sheh kolegët koordinatorë dhe as ekipet e tyre.
- **Cakton njësinë** dhe **supervizorin** për njerëzit e vet.
- **Sugjeron pezullimin / riaktivizimin** e vullnetarëve brenda hierarkisë së
  vet — vendimin e zbaton Admini.
- **Miraton vullnetarë të rinj në komunikim me Adminin.** Vendimi merret bashkë;
  veprimi në portal kryhet nga Admini.
- **Shkruan njoftime** dhe **ngarkon materiale**.
- **Shqyrton dhe mbyll raportime.**
- Redakton të dhënat e njësive të veta (emri, rajoni, territori, objektivi).
- Sheh gjithë degën e vet të strukturës.

### Çfarë NUK bën

- **Nuk cakton role.** Vetëm Admini.
- **Nuk aktivizon dhe nuk çaktivizon njësi** — kërkesa shkon te Admini.
- **Nuk merr më shumë se tri njësi.** Kufiri mbron cilësinë e mbikëqyrjes.
- Nuk prek njësitë, njerëzit ose turnet e një koordinatori tjetër.
- Nuk merr vendime ligjore — pyetja shkon te Juristi.

### Profili

Përvojë drejtuese, qoftë edhe joformale. Njohje e mirë e territorit dhe e
njerëzve të tij. Disponueshmëri reale (ky rol kërkon 15–25 orë në javë gjatë
kulmit). Qetësi në konflikt. Aftësi për të thënë "jo" pa e humbur njeriun.

---

\newpage

## Jurist (qendra) — `jurist`

**Shtresa:** 1 (qendra) · **Raporton te:** Admin ·
**Nën vete:** askush · **Numri i pritur:** 3 persona

### Koncepti

Juristi është **garancia që 50,000 nënshkrime nuk shndërrohen në 50,000 fletë
të pavlefshme**. Në një nismë referendumi, rreziku më i madh nuk është
mospasja e nënshkrimeve — është pasja e tyre në një formë që institucioni nuk i
pranon. Një gabim i vetëm në formatin e formularit, i shumëzuar me dhjetëra
mijëra, e mbyt fushatën pa asnjë kundërshtar politik.

Juristi punon mbi **procedurën, jo mbi njerëzit**. Ai nuk i sheh të dhënat
personale të vullnetarëve, nuk i pezullon dhe nuk i cakton askund — dhe kjo
është me qëllim: puna e tij është mbi formularin, ligjin dhe raportimet
ligjore, dhe asnjë prej tyre nuk kërkon listën e telefonave të terrenit. Sa më
pak të dhëna personale të prekë një rol, aq më pak rrezik mban fushata.

### Përgjegjësitë kryesore

- **Të verifikojë bazën ligjore** të nismës dhe të gjithë procedurën e kërkesës
  për referendum: kush ka të drejtë të nënshkruajë, si verifikohen nënshkrimet,
  cilat janë afatet dhe kujt i dorëzohen fletët.
- **Të miratojë formularin e nënshkrimit** dhe çdo ndryshim të tij. Asnjë
  formular nuk shkon në terren pa këtë miratim.
- **Të autorizojë mbledhësit e autorizuar.** Askush nuk mbledh nënshkrime si
  mbledhës pa autorizimin e Juristit: ai verifikon se personi është trajnuar,
  e njeh formularin dhe udhëzimin ligjor, dhe e regjistron si të autorizuar.
  Kjo është arsyeja pse roli quhet "i autorizuar" dhe jo thjesht "mbledhës".
- **Të hartojë udhëzimin ligjor** për terrenin: çfarë lejohet t'i thuhet
  qytetarit, çfarë jo, si veprohet kur ndërhyn policia ose një autoritet.
- **Të trajtojë çdo raportim me etiketën "Shqetësim ligjor"**, me përparësi.
- **Të mbrojë të dhënat personale**: formularët përmbajnë emra dhe të dhëna
  identifikuese; ruajtja, transporti dhe asgjësimi i tyre janë detyrim ligjor,
  jo praktikë e brendshme.
- **Të përgatisë dorëzimin final** te institucioni kompetent, me gjithë
  dokumentacionin shoqërues.

### Detyra konkrete

| Kur | Çfarë |
|---|---|
| Në nisje | Verifikon procedurën, formularin, afatet; harton udhëzimin ligjor. |
| Sipas rastit | **Autorizon mbledhësit e rinj** pasi verifikon trajnimin dhe njohjen e formularit. |
| Ditore | Shqyrton raportimet ligjore; përgjigjet brenda 24 orësh. |
| Javore | Kontrollon mostër formularësh të mbledhur për saktësi. |
| Javore | Përditëson seksionin "Dokumente ligjore" te Materialet. |
| Sipas rastit | Këshillon për çaktivizimin e një njësie problematike. |
| Në fund | Drejton përgatitjen dhe dorëzimin zyrtar të nënshkrimeve. |

> **Shënim i domosdoshëm:** referencat konkrete ligjore (neni kushtetues për
> nismën qytetare, ligji për referendumin, ligji për mbrojtjen e të dhënave
> personale, afatet dhe formati i formularit) duhet të verifikohen nga juristi
> kundrejt **tekstit në fuqi në datën e nisjes së fushatës** dhe të shkruhen si
> shtojcë e këtij dokumenti. Ky dokument përshkruan strukturën, jo ligjin.

### Të drejtat në portal

- **Sheh të gjitha raportimet** dhe i trajton — sidomos ato ligjore.
- Sheh gjithë turnet e planifikuara.
- Shkruan njoftime dhe ngarkon materiale (dokumentet ligjore janë të tijat).
- Merr njoftimet interne të qendrës.

### Çfarë NUK bën

- **Nuk pezullon dhe nuk riaktivizon** asnjë vullnetar.
- **Nuk cakton njësinë dhe nuk cakton supervizorin** e askujt.
- **Nuk del në terren si mbledhës** dhe nuk bën check-in. (Nëse dëshiron, mund
  të dalë në terren për të informuar qytetarët — por kjo nuk është detyrim i
  rolit dhe nuk e bën atë pjesë të ekipit mbledhës.)
- Nuk planifikon turne dhe nuk aktivizon/çaktivizon njësi.
- Nuk cakton role (vetëm Admini) dhe nuk mirato vullnetarë të rinj.
- Nuk komunikon me median pa u koordinuar me PR & Edukim.

> Kur juristit i duhet të kontaktojë një vullnetar konkret (p.sh. dëshmitar i
> një incidenti), kërkesa shkon te **Admini** ose te **koordinatori** përkatës.
> Kjo lë gjurmë se kush e kërkoi kontaktin dhe pse — që është pikërisht ajo që
> kërkon mbrojtja e të dhënave personale.

### Profili

Jurist i kualifikuar, mundësisht me përvojë në të drejtë kushtetuese,
zgjedhore ose administrative. Aftësi për të shkruar udhëzime të thjeshta për
njerëz jo-juristë — një udhëzim që vullnetari nuk e kupton nuk mbron askënd.

---

\newpage

## Logjistikë (qendra) — `logjistike`

**Shtresa:** 1 (qendra) · **Raporton te:** Admin ·
**Nën vete:** askush · **Numri i pritur:** 5 persona

### Koncepti

Logjistika është arsyeja pse ekipi që del të martën në orën 18:00 **ka
formularë në dorë**. Ky rol është i padukshëm kur funksionon dhe katastrofik kur
dështon: një ekip pa formularë është një turn i humbur, dhe një turn i humbur
janë 70 nënshkrime që nuk kthehen kurrë.

Në një fushatë referendumi, logjistika ka një veçori që nuk e ka asnjë fushatë
tjetër: **materiali që qarkullon nuk është reklamë, është dokument**. Formularët
e nënshkruar janë prova. Prandaj logjistika mban jo vetëm furnizimin, por edhe
**zinxhirin e kujdestarisë** — kush e mori, kur, sa fletë, kush ia dorëzoi kujt.

### Përgjegjësitë kryesore

- **Furnizimi i terrenit**: formularë, fletë-palosje, stilolapsa, tabela,
  bluza/shenja identifikuese, çadra.
- **Zinxhiri i kujdestarisë së formularëve**: regjistri i fletëve të dhëna dhe
  i fletëve të kthyera, të bardha dhe të nënshkruara.
- **Ruajtja e sigurt** e formularëve të nënshkruar deri te dorëzimi zyrtar,
  sipas udhëzimit të Juristit.
- **Transporti**: lëvizja e materialeve midis zonave dhe qendrës.
- **Parashikimi i stokut**: sa formularë duhen javën tjetër, bazuar në ritmin
  real të mbledhjes.
- **Pajisjet e ngjarjeve**: tavolina, çadra, energji, printime urgjente.

### Detyra konkrete

| Kur | Çfarë |
|---|---|
| Javore | Llogarit nevojat e javës sipas orarit të turneve dhe ritmit të firmave. |
| Javore | Shpërndarja te koordinatorët; nënshkrim marrjeje. |
| Ditore | Përditëson gjendjen e stokut; alarmon Adminin kur bie nën pragun kritik. |
| Ditore | Trajton raportimet "Material i humbur". |
| Vazhdimisht | Mban regjistrin e fletëve: të dhëna / të kthyera / të nënshkruara. |
| Mujore | Inventar i plotë dhe barazim me numrat e raportuar të nënshkrimeve. |

### Të drejtat në portal

- Sheh gjithë vullnetarët dhe gjithë strukturën (rol i qendrës).
- Sheh të gjitha turnet e planifikuara — për të ditur ku duhen materialet.
- **Shkruan njoftime** — sepse lajmi "materialet mbërrijnë të mërkurën në
  zonën B" duhet të dalë kur e di logjistika, jo kur gjen kohë admini.
- **Sheh të gjitha raportimet dhe i trajton ose i mbyll** — raportimet
  "Material i humbur" janë tërësisht të tijat.
- Sheh dhe merr **njoftimet interne** ("Vetëm qendra & koordinatorët").
- Sheh materialet dhe njoftimet.

### Çfarë NUK bën

- Nuk del në terren si mbledhës dhe nuk bën check-in.
- Nuk planifikon turne dhe nuk aktivizon/çaktivizon njësi.
- Nuk cakton role dhe nuk mirato vullnetarë.
- Nuk pezullon vullnetarë dhe nuk cakton njësi ose supervizorë.

### Profili

Organizim praktik, jo teori. Përvojë me inventar, transport ose menaxhim
ngjarjesh. Njeri që mban listë dhe e mban të përditësuar. Disponibël në orare
të pazakonta — materialet lëvizin kur ekipet janë jashtë.

---

\newpage

## Burime Njerëzore — BNj (qendra) — `burime_njerezore`

**Shtresa:** 1 (qendra) · **Raporton te:** Admin ·
**Nën vete:** askush · **Numri i pritur:** 5 persona

### Koncepti

Në një fushatë me vullnetarë, **njerëzit janë burimi i vetëm i kufizuar**. Paratë
mund të mblidhen, materialet mund të printohen, por një vullnetar që largohet i
zhgënjyer rrallë kthehet — dhe merr me vete edhe dy të tjerë.

BNj-ja ekziston sepse rekrutimi dhe mirëqenia janë punë me kohë të plotë që
koordinatorët nuk e bëjnë dot: ata janë tepër të zënë me terrenin. BNj-ja
mban **rrjedhën** — nga interesimi i parë deri te turni i njëqindtë — dhe
**temperaturën** e organizatës.

**Rekrutimi dhe trajnimi janë pjesa më e fortë e kësaj fushate.** Një fushatë
nënshkrimesh nuk fitohet me një ide të mirë, por me shumë njerëz të përgatitur
mirë dhe të shpërndarë në kohën e duhur. Sa më herët të hyjë një vullnetar në
sistem dhe sa më mirë të trajnohet, aq më shumë vlen çdo orë e tij në terren.

Prandaj puna e BNj-së nuk mbaron te "gjeta njerëz". Të **kanalizosh** dhe të
**edukosh** vullnetarët që ata të jenë sa më efikasë në mbledhje është avantazh
i drejtpërdrejtë i fushatës: një vullnetar i trajnuar mirë mbledh më shumë
firma në të njëjtën orë, bën më pak gabime në formular dhe krijon më pak
probleme që dikush tjetër duhet t'i zgjidhë. Kjo e bën gjithë fushatën e
mbledhjes të ecë butë — pa bllokime, pa rinisje dhe pa turne të humbura.

### Përgjegjësitë kryesore

- **Rekrutimi**: kanalet, mesazhi, ndjekja e njerëzve të rinj që shfaqin interes.
- **Pritja (onboarding)**: që një vullnetar i ri të mos presë dhjetë ditë pa
  përgjigje. Objektivi: nga regjistrimi te turni i parë brenda **7 ditësh**.
- **Ndjekja e miratimeve**: sinjalizon Adminin kur radha e "Në pritje" rritet.
- **Trajnimi**: organizon sesionet hyrëse dhe trajnimin e mbledhësve, bashkë me
  Juristin (pjesa ligjore) dhe koordinatorët (pjesa praktike).
- **Mirëqenia dhe mbajtja**: kontakton ata që kanë humbur turne, kupton pse, i
  kthen ose i lëshon me respekt.
- **Njohja e kontributit**: falënderime, shënime publike, shënjimi i arritjeve.
  Në punë vullnetare, njohja është e vetmja "pagë".
- **Zgjidhja e konflikteve** brenda ekipeve, kur koordinatori nuk e zgjidh dot.
- **Planifikimi i kapaciteteve**: sa ndihmës duhen, ku mungojnë, kush është
  gati për ngritje.

### Detyra konkrete

| Kur | Çfarë |
|---|---|
| Ditore | Kontakton regjistrimet e reja; përgatit dosjen për miratim te Admini. |
| Javore | Raport i gjendjes së njerëzve: të rinj, aktivë, joaktivë, të larguar. |
| Javore | Sesion pritjeje për vullnetarët e rinj. |
| Javore | Kontakton ata që humbën dy turne radhazi. |
| Mujore | Vlerësimi i ngritjeve bashkë me koordinatorët. |
| Vazhdimisht | Mban listën e pritjes së kandidatëve për mbledhës. |

### Të drejtat në portal

- Sheh gjithë vullnetarët dhe **gjithë strukturën** — kjo është pamja bazë e
  punës së saj/tij.
- Sheh të gjitha turnet e planifikuara (kush punon ku dhe sa shpesh).
- **Sheh të gjitha raportimet dhe i trajton ose i mbyll** — konfliktet dhe
  ankesat për sjellje janë punë e BNj-së, jo e koordinatorit që është palë.
- **Ngarkon ose fshin materiale** te faqja "Materiale": materialet e trajnimit,
  udhëzuesit e pritjes, dhe çdo informacion që lidhet me kapitalin njerëzor.
- **Shkruan njoftime** — thirrjet për rekrutim, sesionet e trajnimit dhe
  njoftimet për vullnetarët dalin kur i di BNj-ja.
- Merr njoftimet interne.

### Çfarë NUK bën

- **Vendos për pranimin e vullnetarëve të rinj në marrëveshje me Adminin** —
  BNj-ja përgatit dosjen dhe e merr vendimin bashkë me Adminin, ndërsa veprimi
  në portal (miratimi dhe dhënia e rolit) kryhet nga Admini. Kështu ruhet një
  zinxhir i vetëm përgjegjësie pa e ngadalësuar pranimin.
- **Nuk cakton role vetë.** Rolin e jep Admini.
- Nuk del në terren si mbledhës dhe nuk planifikon turne.
- Nuk pezullon njerëz — propozon te Admini ose te koordinatori përkatës.

### Profili

Njeri që i mban mend njerëzit. Përvojë në rekrutim, mësimdhënie, punë sociale
ose organizim komunitar. Durim me ndjekjen e vazhdueshme (follow-up) — 70% e
kësaj pune është të kujtosh të telefonosh sërish.

---

\newpage

## PR & Edukim (qendra) — `pr_edukim`

**Shtresa:** 1 (qendra) · **Raporton te:** Admin ·
**Nën vete:** askush · **Numri i pritur:** 6 persona

### Koncepti

Ky rol ka dy gjysma që duken të ndryshme por janë e njëjta gjë: **të bësh
qytetarin ta kuptojë pse duhet të nënshkruajë**.

- **Edukimi** është puna e brendshme dhe publike e shpjegimit: çfarë është
  ligji 21/2024, çfarë ndryshon nëse shfuqizohet, pse referendumi është mjeti.
- **PR-i** është puna e pranisë: media, rrjetet sociale, komunikatat, përgjigjet
  ndaj sulmeve dhe dezinformimit.

Në një fushatë referendumi, kundërshtari kryesor nuk është zakonisht kundërshtimi
i hapur — është **mosdija dhe indiferenca**. Prandaj mesazhi duhet të jetë i
njëjtë në televizor dhe në trotuar. PR & Edukim është roli që siguron këtë:
vullnetari në terren duhet të përdorë të njëjtat fjalë që përdor faqja zyrtare.

### Përgjegjësitë kryesore

- **Mesazhi i fushatës**: një mesazh i vetëm, i thjeshtë, i vërtetë, i
  përsëritur kudo.
- **Materialet e komunikimit**: fletë-palosje, postera, pamje për rrjete
  sociale, video të shkurtra.
- **Argumentari dhe FAQ** për terrenin: përgjigjet e sakta për 20 pyetjet që
  bën qytetari më shpesh, plus çfarë të mos thuhet kurrë.
- **Marrëdhëniet me median**: komunikatat, intervistat, zëdhënia.
- **Përgjigjja ndaj dezinformimit**: shpejt, faktikisht, pa u tërhequr në
  konflikt personal.
- **Trajnimi i komunikimit** për mbledhësit dhe koordinatorët.
- **Prezenca në rrjete**: kalendari i postimeve, ngjarjet, dëshmitë.

### Detyra konkrete

| Kur | Çfarë |
|---|---|
| Ditore | Menaxhon rrjetet sociale; monitoron çfarë thuhet për nismën. |
| Ditore | Përgjigjet ndaj pyetjeve publike dhe dezinformimit. |
| Javore | Përgatit materialet e reja; përditëson FAQ-në sipas pyetjeve nga terreni. |
| Javore | Komunikatë ose përditësim publik për ecurinë e fushatës. |
| Sipas rastit | Organizon ngjarje publike bashkë me Logjistikën dhe koordinatorët. |
| Vazhdimisht | Mbledh dëshmi dhe fotografi nga terreni (**me pëlqim**). |

### Të drejtat në portal

- Sheh gjithë vullnetarët, gjithë strukturën dhe gjithë turnet.
- **Sheh të gjitha raportimet dhe i trajton ose i mbyll** — një incident publik
  bëhet çështje komunikimi brenda minutash, ndaj PR-i duhet ta shohë i pari.
- **Ngarkon ose fshin materiale** te faqja "Materiale" — fletë-palosjet,
  argumentari, FAQ-ja dhe pamjet për rrjete janë prodhim i këtij roli.
- **Shkruan njoftime** në portal dhe publikon në rrjetet sociale zyrtare.
- Merr njoftimet interne.
- Sheh të gjitha materialet.

### Çfarë NUK bën

- Nuk del në terren si mbledhës dhe nuk planifikon turne.
- **Nuk jep interpretime ligjore.** Çdo pretendim ligjor publik kalon nga
  Juristi para se të dalë.
- Nuk publikon foto ose të dhëna të vullnetarëve pa pëlqimin e tyre.

### Profili

Përvojë në komunikim, gazetari, marketing ose fushata. Aftësi për të shkruar
shkurt dhe qartë. Qetësi në sulm publik. Njohje e mediave shqiptare dhe e
dinamikës së rrjeteve sociale.

---

\newpage

## IT (qendra) — `it`

**Shtresa:** 1 (qendra) · **Raporton te:** Admin ·
**Nën vete:** askush · **Numri i pritur:** 5 persona

### Koncepti

IT-ja mban **sistemin nervor** të fushatës. Portali nuk është një lehtësi — ai
është regjistri i vetëm i vërtetë i asaj që po ndodh: kush është aktiv, ku po
mblidhet, sa është mbledhur, çfarë ka shkuar keq. Nëse portali bie në javën e
fundit, fushata humb pamjen e vet mbi veten.

IT-ja ka gjithashtu një përgjegjësi që nuk e ndan me askënd tjetër përveç
Juristit: **në këtë sistem ruhen të dhëna personale** — foto identifikuese,
telefona, vendndodhje, kontakte urgjence. Mbrojtja e tyre është detyrë teknike
dhe ligjore njëkohësisht.

### Përgjegjësitë kryesore

- **Mirëmbajtja e portalit** dhe e bazës së të dhënave (Supabase); ndjekja e
  gabimeve; rikthimi i shpejtë kur diçka prishet.
- **Kopjet rezervë (backup)** të rregullta dhe **prova e rikthimit** — një
  backup i paprovuar nuk është backup.
- **Siguria**: politikat e aksesit (RLS), çelësat, llogaritë, pajisjet.
- **Njoftimet në telefon** (Web Push) dhe funksionimi i tyre në iOS/Android.
- **Mbështetja e përdoruesve**: vullnetarë që nuk hyjnë dot, foto që nuk
  ngarkohet, njoftime që nuk vijnë.
- **Të dhënat dhe raportimi**: nxjerrja e numrave për Adminin dhe koordinatorët.
- **Mbrojtja e privatësisë**: minimizimi i të dhënave, fshirja pas fushatës.

### Detyra konkrete

| Kur | Çfarë |
|---|---|
| Ditore | Kontrollon gjendjen e sistemit dhe gabimet e reja. |
| Ditore | Mbështetje për problemet e vullnetarëve me portalin. |
| Javore | Verifikon backup-in; provon rikthimin në një kopje testuese. |
| Javore | Kontrollon aksesin: llogari të vjetra, role të pasakta, pajisje të humbura. |
| Sipas nevojës | Ndryshime në portal sipas kërkesave të Qendrës. |
| Në fund | Arkivimi dhe **fshirja e sigurt** e të dhënave personale. |

### Të drejtat në portal

- Sheh gjithë vullnetarët, gjithë strukturën dhe gjithë turnet (rol i qendrës).
- **Sheh të gjitha raportimet dhe i trajton ose i mbyll** — problemet me
  portalin, hyrjen dhe njoftimet vijnë pikërisht si raportime.
- **Shkruan njoftime** — ndërprerjet, mirëmbajtja dhe udhëzimet teknike
  njoftohen nga IT-ja vetë.
- Merr njoftimet interne.
- **Në nivel infrastrukture** ka akses teknik në bazën e të dhënave — akses që
  përdoret vetëm për mirëmbajtje, kurrë për vendime operative.

### Çfarë NUK bën

- Nuk del në terren si mbledhës dhe nuk planifikon turne.
- **Nuk cakton role, nuk mirato vullnetarë, nuk krijon njësi** — as përmes bazës
  së të dhënave. Aksesi teknik nuk është autorizim organizativ.
- Nuk nxjerr të dhëna personale jashtë sistemit pa miratimin e Juristit dhe
  Adminit.
- Nuk bën ndryshime në prodhim pa një kopje rezervë paraprake.

### Profili

Njohuri praktike me web, bazë të dhënash dhe hosting. Disponueshmëri për
urgjenca. **Disiplinë me të dhënat personale** — ky është kriteri vendimtar,
më shumë se aftësia teknike.

---

\newpage

## Admin (qendra) — `admin`

**Shtresa:** 1 (qendra) · **Raporton te:** organi drejtues i nismës ·
**Nën vete:** e gjithë organizata · **Numri i pritur:** 5 persona (ekip admini)

### Koncepti

Admini është **autoriteti i fushatës mbi anëtarësinë**. Ky rol nuk zgjidhet
kurrë vetë dhe nuk figuron as si opsion në formularin e regjistrimit: ai
caktohet me dorë dhe jepet vetëm nga një admin ekzistues.

Koncepti themelor këtu është **përqendrimi i qëllimshëm i vendimeve të
pakthyeshme**. Në një fushatë me qindra vullnetarë, dy veprime nuk kthehen dot
— **kush hyn në organizatë** dhe **kush merr çfarë roli** — dhe pikërisht ato
janë mbajtur te një rol i vetëm. Kjo e ngadalëson pak fushatën, por e bën të
pathyeshme nga brenda: nuk ka rrugë tjetër për t'u bërë koordinator ose admin
veçse përmes një vendimi të gjurmueshëm njeriu.

Pjesa operative e punës me njësitë (krijimi i tyre dhe pragjet) është
**e deleguar te koordinatori**, për njësitë që mban. Aktivizimi dhe çaktivizimi
i një njësie mbetet te Admini, sepse është leva që ndalon menjëherë mbledhjen në
një territor. Admini nuk është pengesë e punës së përditshme — planifikimin e
turneve nuk e prek fare; ai është porta e hyrjes në organizatë.

### Ekipi i adminit, jo një person i vetëm

Roli mbahet nga **pesë veta**, dhe kjo kërkon disiplinë: e drejta është e rolit,
por përgjegjësia duhet të jetë e një personi në çdo çast. Prandaj:

- mbahet një **radhë kujdestarie** — kush e shqyrton radhën "Në pritje" sot;
- vendimet e mëdha (heqje roli, pezullim koordinatori) merren **me dijeninë e
  të pestëve**, kurrë vetëm;
- çdo admin i ri shtohet vetëm me vendim të rënë dakord, jo në heshtje.

Pa këto tri rregulla, pesë admina do të thotë pesë politika të ndryshme
miratimi — dhe vullnetari mëson shpejt se cilit t'i kërkojë.

### Përgjegjësitë kryesore

- **Miratimi i vullnetarëve të rinj** — vendimi merret në marrëveshje me
  BNj-në, koordinatorin ose mbledhësin përkatës, por veprimi në portal është
  i adminit — dhe **caktimi i roleve**, ekskluzivisht i adminit.
- **Caktimi i koordinatorëve** te njësitë.
- **Shqyrtimi i kërkesave për ndryshim** (foto, të dhëna profili, njësi).
- **Mbikëqyrja e gjithë strukturës** dhe e ecurisë ndaj objektivit.
- **Vendimet e shkallëzimit**: gjithçka që koordinatorët nuk e zgjidhin dot.
- **Koordinimi i qendrës**: jurist, logjistikë, BNj, PR, IT.

### Detyra konkrete

| Kur | Çfarë |
|---|---|
| **Ditore** | Shqyrton radhën "Në pritje": mirato / refuzo, jep rolin. |
| **Ditore** | Shqyrton kërkesat për ndryshim (foto, profil, njësi). |
| Ditore | Kontrollon ecurinë ndaj objektivit dhe raportimet e hapura. |
| Javore | Takim me koordinatorët; takim me qendrën. |
| Javore | Rishikon pragjet e njësive sipas rezultateve reale. |
| Sipas rastit | Ndryshon role; cakton koordinatorë; ndërhyn te konfliktet. |
| Mujore | Rishikim i plotë i strukturës: kush mungon, kush duhet ngritur. |

### Të drejtat në portal

Admini ka **të gjitha të drejtat**, përfshirë ato ekskluzive:

| Veprim ekskluziv i Adminit |
|---|
| Miratimi/refuzimi i vullnetarëve të rinj (vendim i marrë në marrëveshje) |
| Caktimi dhe ndryshimi i roleve |
| Caktimi i koordinatorit te një njësi |
| **Aktivizimi ose çaktivizimi i një njësie** |
| Pezullimi ose riaktivizimi i një vullnetari |
| Shqyrtimi i kërkesave për ndryshim |
| Fshirja e raportimeve |
| Faqet "Admin" dhe "Historiku" |

Krijimi i njësive dhe pragu i nënshkrimeve **nuk janë ekskluzive**: i ka edhe
koordinatori, për njësitë që mban.

### Çfarë NUK bën

- **Nuk mbledh nënshkrime dhe nuk bën check-in.** Roli `admin` nuk është rol
  terreni; nëse admini del të mbledhë, e bën me një llogari të dytë me rol
  terreni.
- **Nuk planifikon turne** — as ai. Turnet i planifikojnë vetëm koordinatorët
  dhe mbledhësit, secili në njësinë e vet.
- Nuk merr vendime ligjore pa Juristin.
- Nuk duhet të jetë "i vetmi që di" — çdo vendim i rëndësishëm dokumentohet.

### Profili

Besim i plotë i nismës. Gjykim i qetë nën presion. Disponueshmëri çdo ditë,
përfshirë fundjavat. Aftësi për të deleguar — një admin që bën gjithçka vetë
bëhet pengesa e fushatës.

\newpage

# Matrica e të drejtave

Shkurtimet: **Ndi** Ndihmës · **Mbl** Mbledhës · **Koo** Koordinator ·
**Jur** Jurist · **Log** Logjistikë · **BNj** Burime Njerëzore ·
**PR** PR & Edukim · **IT** IT · **Adm** Admin.

Shënim: ✓ = po · — = jo · **(v)** = vetëm të vetat / vetëm degën e vet ·
**(z)** = vetëm njësitë e veta · **(a)** = vendimi merret në marrëveshje me
Adminin, veprimin në portal e kryen Admini · **(s)** = sugjeron, vendos Admini.

## Terreni dhe turnet

| Veprimi                                              |  Ndi  |  Mbl  |  Koo  |  Jur  |  Log  |  BNj  |   PR  |   IT  |  Adm  |
|------------------------------------------------------|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|
| Regjistrohet në një turn                             |   ✓   |   ✓   |   ✓   |   —   |   —   |   —   |   —   |   —   |   —   |
| Bën check-in                                         |   ✓   |   ✓   |   ✓   |   —   |   —   |   —   |   —   |   —   |   —   |
| Hap një turn                                         |   —   |  ✓(v) |  ✓(z) |   —   |   —   |   —   |   —   |   —   |   —   |
| Mbyll turnin dhe raporton firmat                     |   —   |  ✓(v) |  ✓(z) |   —   |   —   |   —   |   —   |   —   |   —   |
| Fshin një turn të hapur prej tij                     |   —   |  ✓(v) |  ✓(v) |   —   |   —   |   —   |   —   |   —   |   ✓   |
| Sheh listën e turneve                                |  ✓(v) |  ✓(v) |  ✓(v) |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Sheh "Në terren tani"                                |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |

## Njerëzit dhe struktura

| Veprimi                                              |  Ndi  |  Mbl  |  Koo  |  Jur  |  Log  |  BNj  |   PR  |   IT  |  Adm  |
|------------------------------------------------------|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|
| Sheh listën e plotë të vullnetarëve                  |   —   |   —   |  ✓(z) |   —   |   —   |   —   |   —   |   —   |   ✓   |
| Sheh telefonin / kontaktin e urgjencës               |   —   |   —   |  ✓(z) |   —   |   —   |   —   |   —   |   —   |   ✓   |
| Sheh diagramin e strukturës                          |  ✓(v) |  ✓(v) |  ✓(v) |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| **Mirato vullnetarë të rinj**                        |   —   |  (a)  |  (a)  |   —   |   —   |  (a)  |   —   |   —   |   ✓   |
| **Cakton ose ndryshon rolin**                        |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   ✓   |
| Pezullon ose riaktivizon dikë                        |   —   |   —   |  (s)  |   —   |   —   |  (s)  |   —   |   —   |   ✓   |
| Cakton njësinë e dikujt                              |   —   |   —   |  ✓(z) |   —   |   —   |   —   |   —   |   —   |   ✓   |
| Cakton supervizorin e dikujt                         |   —   |   —   |  ✓(z) |   —   |   —   |   —   |   —   |   —   |   ✓   |
| **Shqyrton kërkesat për ndryshim**                   |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   ✓   |

## Përmbajtja: njoftime, materiale, raportime

| Veprimi                                              |  Ndi  |  Mbl  |  Koo  |  Jur  |  Log  |  BNj  |   PR  |   IT  |  Adm  |
|------------------------------------------------------|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|
| Lexon njoftimet publike                              |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Lexon njoftimet **interne**                          |   —   |   —   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Shkruan njoftime                                     |   —   |   —   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Sheh materialet                                      |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Ngarkon ose fshin materiale                          |   —   |   —   |   ✓   |   ✓   |   —   |   ✓   |   ✓   |   —   |   ✓   |
| Hap një raportim                                     |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Sheh raportimet                                      |  ✓(v) |  ✓(v) |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Trajton ose mbyll raportime                          |   —   |   —   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Fshin raportime                                      |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   ✓   |

## Sistemi dhe njësitë

| Veprimi                                              |  Ndi  |  Mbl  |  Koo  |  Jur  |  Log  |  BNj  |   PR  |   IT  |  Adm  |
|------------------------------------------------------|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|
| Sheh njësitë dhe ecurinë e tyre                      |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Krijon ose fshin një njësi                           |   —   |   —   |  ✓(z) |   —   |   —   |   —   |   —   |   —   |   ✓   |
| Aktivizon ose çaktivizon një njësi                   |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   ✓   |
| **Cakton koordinatorin e njësisë**                   |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   ✓   |
| Redakton të dhënat e njësisë                         |   —   |  ✓(v) |  ✓(z) |   —   |   —   |   —   |   —   |   —   |   ✓   |
| Cakton pragun e nënshkrimeve                         |   —   |   —   |  ✓(z) |   —   |   —   |   —   |   —   |   —   |   ✓   |
| Faqja "Admin" dhe "Historiku"                        |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   —   |   ✓   |

> **Vini re tri asimetri të qëllimshme.**
>
> *E para:* **vendimi** për të pranuar një vullnetar të ri merret bashkë — nga
> mbledhësi, koordinatori ose BNj-ja, në marrëveshje me Adminin — por
> **veprimi** kryhet nga një dorë e vetme, ajo e Adminit. Vendimi është i
> përbashkët që të jetë i shpejtë dhe i informuar; veprimi është i vetëm që
> hyrja në organizatë të mbetet e gjurmueshme.
>
> *E dyta:* puna mbi **turnin** është e deleguar poshtë (mbledhësi vendos turnet
> e njësisë së vet, koordinatori ato të 2–3 njësive), ndërsa puna mbi
> **njësinë** dhe mbi **njeriun** rri lart. Kur punohet e vendos terreni; nëse
> një njësi punon apo ndalet, dhe kush hyn me çfarë roli, e vendos qendra.
>
> *E treta:* juristi trajton çdo raportim, por nuk sheh asnjë numër telefoni.
> Aksesi jepet sipas punës që bëhet, jo sipas pozitës në organigram — dhe puna
> e juristit është mbi procedurën, jo mbi njerëzit.

\newpage

# Rrjedhat kryesore të punës

## Nga regjistrimi te turni i parë

1. Personi regjistrohet vetë në portal: emri, qyteti, telefoni, roli i **kërkuar**.
2. Llogaria krijohet me status **në pritje** dhe rol `ndihmës`. Nuk sheh asgjë.
3. **BNj** e kontakton, verifikon interesin dhe përgatit dosjen.
4. **BNj-ja dhe Admini** vendosin bashkë për pranimin — sipas rastit edhe
   koordinatori ose mbledhësi që do ta presë. **Admini** e mirato te faqja
   "Admin" dhe i jep **rolin real**.
5. Personi ngarkon **foton** e kartës (një herë; pas kësaj vetëm me kërkesë).
6. **Admini ose koordinatori** i cakton **njësinë** dhe **supervizorin**.
7. **BNj** e fut në sesionin e pritjes; koordinatori/mbledhësi e fut në turnin e parë.

**Objektiv kohor: nga hapi 1 te hapi 7 — jo më shumë se 7 ditë.**

## Turni: nga planifikimi te numri

Pikënisja merret e mirëqenë: **njësia është e aktivizuar**. Çaktivizimi është
përjashtim, jo hap i rregullt i punës.

1. **Koordinatori ose mbledhësi** hap turnin: njësia, data, ora, kapaciteti,
   shënimi.
2. Vullnetarët e ekipit marrin njoftim dhe **regjistrohen**.
3. 15 minuta para fillimit hapet **check-in-i**. Secili bën check-in kur mbërrin.
4. Ekipi mbledh nënshkrime.
5. **Udhëheqësi që hapi turnin** numëron fletët dhe bën **check-out** me numrin
   real. Turni mbyllet për të gjithë njëherësh.
6. Numri shkon te progresi i fushatës — **një herë të vetme**.
7. Formularët dorëzohen te logjistika sipas zinxhirit të kujdestarisë.

**Kushtet që sistemi kontrollon në check-in:** llogaria është aktive · roli është
rol terreni · turni është i ekipit tënd · ora ka ardhur dhe nuk ka kaluar ·
**njësia është e aktivizuar** · nuk ke një turn tjetër të hapur.

## Raportimi i një problemi

Tri lloje raportimesh, secili me rrugën e vet:

| Lloji | Shembull | Kush e trajton |
|---|---|---|
| **Incident** | Pengesë, presion, ndërhyrje në terren | Koordinatori → Admini |
| **Incident** | Konflikt personal, ankesë për sjellje | **BNj** |
| **Incident** | Ka dalë publikisht ose në media | **PR & Edukim** |
| **Shqetësim ligjor** | Pyetje për procedurën, kundërshtim ligjor | **Juristi**, me përparësi |
| **Material i humbur** | Formularë, karta, fletushka të humbura/dëmtuara | **Logjistika** |
| **Portali** | Nuk hyj dot, fotoja s'ngarkohet, s'vijnë njoftimet | **IT** |

Rrjedha: kushdo hap raportimin (me foto dhe vendndodhje nëse duhet) → qendra dhe
koordinatorët marrin njoftim → statusi kalon `Hapur → Në shqyrtim → E zgjidhur`,
me shënim se çfarë u bë. Fotot e raportimeve ruhen **privatisht** — i sheh vetëm
autori dhe qendra.

> Që gjashtë rolet të mos shohin njëri-tjetrin duke pritur, rregulli është:
> **kush e merr i pari një raportim, e vendos statusin "Në shqyrtim" me emrin e
> vet.** Një raportim pa pronar është një raportim i pazgjidhur.

**Rregull i artë:** për incidente me rrezik fizik ose me praninë e autoriteteve,
raportimi në portal vjen **pas** telefonatës te koordinatori, jo në vend të saj.

## Ndryshimi i të dhënave personale

Pas plotësimit të parë, vullnetari **nuk i ndryshon dot vetë** emrin, qytetin,
foton, telefonin ose zonën. Ai **propozon** një ndryshim; **vetëm Admini**
vendos. Lejohet vetëm **një kërkesë në pritje për person, për lloj**.

Arsyeja: karta e vullnetarit është dokument identifikimi publik — qytetari mund
ta skanojë QR-in dhe të verifikojë kush është personi përpara tij. Nëse fotoja
dhe emri do të ndryshoheshin lirisht, ajo kartë nuk do të verifikonte më asgjë.

\newpage

# Sa njerëz duhen: modeli i planifikimit

Struktura e fushatës është **e vendosur**: 25 njësi, 10 koordinatorë, 29 veta
në qendër. Prandaj llogaritja këtu nuk shkon nga objektivi te njerëzit, por
nga njerëzit te **ritmi që duhet arritur**. Pyetja nuk është "sa veta duhen",
por: *me këta njerëz dhe këtë afat, sa firma duhet të nxjerrë çdo turn?*

## Supozimet

| Parametri | Vlera | Shënim |
|---|---|---|
| Objektivi zyrtar | 50,000 | Parametër i fushatës |
| Rezervë për të pavlefshme | +30% | **Të konfirmohet nga Juristi** |
| Nënshkrime për t'u mbledhur | **65,000** | 50,000 × 1.30 |
| Njësi (ekipe) | 25 | Një mbledhës i autorizuar për secilën |
| Madhësia e ekipit | 5 (1 mbledhës + 4 ndihmës) | |
| Kohëzgjatja e turnit | 2 orë | Mesatarisht |
| Turne për ekip në javë | 5 | Ritëm i lartë — kërkon rotacion |
| Kohëzgjatja e fushatës | 8 javë (2 muaj) | |

## Llogaritja

```
   STRUKTURA E DHËNË
   Njësi (ekipe)                  =  të dhëna         =   25 njësi
   Mbledhës të autorizuar         =  1 për njësi      =   25 veta
   Ndihmës                        =  25 × 4           =  100 veta
   Koordinatorë                   =  25 ÷ 2.5 njësi   =   10 veta
   Njerëz në terren               =  25+100+10        =  135 veta
   Qendra  (5+3+5+5+6+5)          =  role fikse       =   29 veta
   ───────────────────────────────────────────────────────────────
   GJITHSEJ                       =  135 + 29         =  164 veta

   SA PUNË DEL NGA KJO STRUKTURË
   Turne për ekip gjatë fushatës  =  5/javë × 8 javë  =   40 turne
   Turne ekipore gjithsej         =  25 ekipe × 40    = 1000 turne

   RITMI QË DUHET ARRITUR PËR 65,000
   Firma për turn                 =  65,000 ÷ 1000    =   65 firma
   Firma për orë (turn 2-orësh)   =  65 ÷ 2           ≈   33 firma
   Firma për person në orë        =  33 ÷ 5 veta      ≈  6.5 firma
```

## Shpërndarja e strukturës

| Roli | Numri i synuar | % e organizatës |
|---|---:|---:|
| Ndihmës | 100 | 61.0% |
| Mbledhës i autorizuar | 25 | 15.2% |
| Koordinator | 10 | 6.1% |
| Qendra (6 role) | 29 | 17.7% |
| **Gjithsej** | **164** | **100%** |

Qendra e zbërthyer: Admin 5 · Jurist 3 · Logjistikë 5 · BNj 5 · PR & Edukim 6 ·
IT 5.

## Si të lexohet ky model

- **Treguesi i vetëm që ka rëndësi është 6.5 firma për person në orë.** Gjithçka
  tjetër është aritmetikë. Nëse ekipet e arrijnë atë ritëm, 65,000 mblidhen; nëse
  jo, asnjë rishpërndarje njerëzish nuk e shpëton afatin.
- **Pesë turne në javë për ekip është ritmi më i guximshëm i këtij plani.** Për
  një vullnetar me punë, kjo do të thotë pothuajse çdo ditë. Realisht mbahet
  vetëm me **rotacion**: ekipi ka 5 veta, por nuk janë të njëjtët 5 çdo herë.
  Ndaj BNj-ja duhet të ketë një bankë ndihmësish rezervë, jo vetëm 100 emra.
- **Rrjedhja është e sigurt.** Nga përvoja e fushatave vullnetare, 30–40% e të
  regjistruarve nuk vijnë kurrë ose largohen brenda muajit. Prandaj BNj-ja duhet
  të rekrutojë **~230 persona** për të mbajtur 164 aktivë.
- **Rikalibro pas javës së parë.** Zëvendëso "65 firma për turn" me mesataren e
  vërtetë nga tabela e njësive. Nëse dalin 45 e jo 65, ke tri zgjedhje: më
  shumë turne, ekipe më të mëdha, ose vende më të mira. **Vendi është zakonisht
  levë më e fortë se orët** — një treg i shtunën vlen sa tri turne rrugësh.
- **8 javë nuk falin asgjë.** Me 12 javë, një javë e humbur rikuperohej. Me 8,
  një javë e humbur është 12.5% e fushatës. Java e parë duhet nisur me ekipe të
  gatshme, jo me rekrutim.

\newpage

# Rregullat e arta

Dhjetë rregulla që nuk negociohen. Ato janë të koduara në sistem, jo vetëm në letër.

1. **Askush nuk punon pa u miratuar.** Regjistrimi nuk është anëtarësim.
2. **Rolin e jep vetëm Admini.** Kërkesa në formular është preferencë, jo e drejtë.
3. **Mbledhja bëhet vetëm në njësi të aktivizuara.** Njësi e çaktivizuar =
   punë e ndaluar, pa përjashtim.
4. **Turnin e planifikon vetëm ai që mban njësinë** — koordinatori në njësitë e
   veta, mbledhësi në njësinë e vet. Një njësi = një mbledhës i autorizuar.
5. **Numrin e raporton vetëm udhëheqësi që hapi turnin**, një herë, për gjithë ekipin.
6. **Formularët e nënshkruar nuk lihen kurrë pa mbikëqyrje** dhe nuk fotografohen.
7. **Çdo shqetësim ligjor shkon te Juristi**, jo te grupi i WhatsApp-it.
8. **Të dhënat personale nuk dalin nga sistemi** pa miratim të Juristit dhe Adminit.
9. **Askush nuk lihet vetëm në presion.** Nëse një vullnetar përballet me
   ndërhyrje, ekipi tërhiqet së bashku dhe raporton.
10. **Numrat janë ashtu siç janë.** Një numër i fryrë sot është një humbje e
    sigurt në verifikim.

# Shkallëzimi: kujt i drejtohesh

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Pyetje për orarin, vendin, materialet e turnit                      │
  │        →  MBLEDHËSI yt                                              │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Problem me ekipin, mungesë materialesh, ndryshim zone               │
  │        →  KOORDINATORI                                              │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Pyetje ligjore, formular i kundërshtuar, ndërhyrje autoriteti       │
  │        →  JURISTI  (përmes një raportimi "Shqetësim ligjor")        │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Materiale të mbaruara ose të humbura                                │
  │        →  LOGJISTIKA  (raportim "Material i humbur")                │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Problem me portalin, hyrjen, foton, njoftimet                       │
  │        →  IT                                                        │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Konflikt personal, mirëqenie, dëshirë për t'u larguar ose ngritur   │
  │        →  BNj                                                       │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Media, deklarata publike, dezinformim                               │
  │        →  PR & EDUKIM                                               │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Gjithçka e pazgjidhur brenda 48 orësh                               │
  │        →  ADMINI                                                    │
  └─────────────────────────────────────────────────────────────────────┘

  RREZIK FIZIK I MENJËHERSHËM  →  telefonatë, jo portal. Pastaj raportim.
```

\newpage

# Shtojca A — Fjalorth

| Termi | Kuptimi |
|---|---|
| **Njësi / Zonë** | **Ekipi** me kod (A1, B2): një mbledhës i autorizuar + ndihmësit e tij. Territori që mbulon mund të lëvizë; kodi jo. |
| **E aktivizuar / e çaktivizuar** | Gjendja e njësisë. Në një njësi të çaktivizuar nuk bëhet check-in dhe nuk mblidhen firma. |
| **Supervizor** | Personi të cilit i raporton drejtpërdrejt: mbledhësi te koordinatori, ndihmësi te mbledhësi. |
| **Turn** | Bllok kohe i planifikuar në një njësi, me ekip të regjistruar. |
| **Check-in** | "Kam mbërritur dhe po nis punën." Hapet 15 min para fillimit. |
| **Check-out** | Mbyllja e turnit + raportimi i nënshkrimeve. Vetëm udhëheqësi. |
| **Udhëheqës i turnit** | Koordinatori ose mbledhësi që e hapi turnin. |
| **Qendra** | Gjashtë rolet që nuk dalin në terren: admin, jurist, logjistikë, BNj, PR, IT. |
| **Pragu i nënshkrimeve** | Objektivi i firmave për një njësi. E cakton koordinatori ose admini. |
| **Kodi i vullnetarit** | Identifikuesi unik i formës `V-0001`, i shtypur në kartë. |
| **Karta ime** | Karta e identifikimit me foto dhe QR, e verifikueshme publikisht. |
| **Kërkesë për ndryshim** | Propozim për ndryshim fotoje/profili/zone; e vendos Admini. |

# Shtojca B — Lista e kontrollit para turnit të parë

Për çdo vullnetar të ri, para se të dalë në terren:

- [ ] Llogaria është **e miratuar** dhe roli i caktuar.
- [ ] Fotoja e kartës është ngarkuar dhe karta funksionon (skano QR-in).
- [ ] Njësia (zona) dhe supervizori janë caktuar.
- [ ] Ka lexuar **guide-book-un** dhe **FAQ-në** te Materialet.
- [ ] Ka lexuar **udhëzimin ligjor** të Juristit: çfarë lejohet të thuhet.
- [ ] Di si plotësohet saktë formulari — e ka provuar një herë me mbikëqyrje.
- [ ] Di kujt i telefonon në rast incidenti (mbledhësi, pastaj koordinatori).
- [ ] I ka aktivizuar **njoftimet** në telefon.
- [ ] Është regjistruar në turnin e parë dhe e di orën e vendin.

---

*Ky dokument përshkruan strukturën e fushatës. Çdo ndryshim strukture duhet të
pasqyrohet njëkohësisht këtu dhe në portal — përndryshe njëri prej të dyve
gënjen.*
