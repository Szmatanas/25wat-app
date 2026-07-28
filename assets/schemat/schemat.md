# 25wat — Schemat generowania zdjęć i grafik

Skonsolidowany schemat wyciągnięty ze skilla `branding-25wat`. Samowystarczalny: wszystko, czego potrzebujesz, żeby wygenerować **grafikę KV** (post, karuzela, story, baner, slajd, A4) oraz **zdjęcie/scenę** zgodne z marką 25wat.

> **Marka w jednym zdaniu:** digital agency na styku sprzedaży, marketingu i technologii. Flat (zero gradientów), dwa kolory brandu (neon + ultraviolet) jako akcent, jeden font (Gilroy), dużo oddechu. Sygnatura: **ZEROBULLSH!T** — konkrety > banały.

Assety, do których odwołuje się ten dokument, leżą w `25wat-assets/` (logo, graphic, fonts, examples, dokumentacja źródłowa).

---

## 0. Szybka decyzja — od czego zacząć

```
1. Jaki FORMAT?        → tabela §1
2. Jakie TŁO?          → dark / beige / neon
3. Jaka PARA kolorów?  → tabela "Pary, które ZAWSZE działają" §3.1  ← serce schematu
4. Zdjęcie czy grafika wektorowa?
      • zdjęcie  → §5 (fotografia + prompt AI)
      • grafika  → §3 (flubber/doodle/element + headline + logo)
5. WALIDACJA przed oddaniem → §6
```

---

## 1. Formaty (wymiary w px)

| Format | Wymiary | Zastosowanie |
|---|---|---|
| Social feed 1:1 | 1080×1080 | Single post LI / IG / FB |
| Social feed 4:5 | 1080×1350 | **Preferowany** post LI / IG |
| Karuzela 4:5 | 1080×1350 | Slajdy karuzeli, numerowane (01, 02…) w prawym górnym |
| Story | 1080×1920 | IG / FB story, TikTok cover |
| Hero web | 1440×810 | Szybki draft hero |
| Baner FB | 820×360 | — |
| Baner LinkedIn | 1128×191 | — |
| Slajd prezentacji | 1920×1080 | Decki sales, oferty, raporty |
| Print A4 | 2480×3508 @300dpi | Print collateral |

**Margines (social):** 80px z każdej strony dla tekstu i logo. Headline nigdy nie dotyka krawędzi.

---

## 2. Fundamenty wizualne

### 2.1 Paleta (płaskie kolory — NIGDY gradient)

**Brand (akcent, ~50% neon / 50% ultraviolet):**

| Kolor | HEX | RGB | Rola |
|---|---|---|---|
| **neon** | `#D0F200` | 208,242,0 | Akcent; tło tylko w wyjątkach (high-impact) |
| **ultraviolet** | `#7648F8` | 118,72,248 | Akcent; NIGDY duża powierzchnia tekstowa, NIGDY jako tło |
| neon 50 | `#EDFF80` | 237,255,128 | Pochodna / hover |
| ultraviolet 50 | `#9C7CF8` | 156,124,248 | Pochodna / hover |

**Neutralne (tła, teksty, linie):**

| Kolor | HEX | RGB | Rola |
|---|---|---|---|
| **black 500** | `#171717` | 23,23,23 | Główny ciemny (tła, teksty) |
| black 300 | `#252525` | 37,37,37 | Kontrast ciemny |
| black 200 | `#454545` | 69,69,69 | Kontrast / teksty |
| black 100 | `#949494` | 148,148,148 | Kontrast / teksty |
| **beige 300** | `#F2EDE3` | 242,237,227 | Główny jasny (tła, teksty) |
| beige 400 | `#E6E1D7` | 230,225,215 | Kontrast jasny |
| beige 100 | `#FEF9F4` | 254,249,244 | Kontrast jasny |

**Semantyczne (tylko UI, nie KV):** success `#00E658`, warning `#FFAF1A`, error `#F20045`.

> Potrzebujesz głębi / separacji warstw? Użyj **drugiej apli z palety neutralnej** (np. black 500 obok black 300) — nigdy gradientu.

### 2.2 Typografia — Gilroy (jedna rodzina, display + body)

Pliki: `25wat-assets/fonts/Gilroy-*.otf`.

| Waga | Num. | Kiedy |
|---|---|---|
| Light | 300 | Tylko na ciemnym tle |
| Regular | 400 | Główny tekst, podpisy, **nie-wyróżniona część headline'u** |
| Medium | 500 | Tylko na wyraźną prośbę |
| **SemiBold** | 600 | **Nagłówki, headliny, wyróżnienia** |
| Bold (plik ExtraBold) | 700 | Tylko na wyraźną prośbę |

**Skala (px / line-height / letter-spacing):**

| Token | Size | LH | LS |
|---|---|---|---|
| h1 | 64 | 80 | −1% |
| h2 | 36 | 48 | −1% |
| h3 | 32 | 40 | −1% |
| h4 | 24 | 32 | −1% |
| h5 | 20 | 32 | −1% |
| body | 16 | 24 | 0% |
| caption | 12 | 18 | 0% |

**Reguła nagłówka (heading-split) — sygnaturowa:** headline domyślnie SemiBold, ale kluczową frazę zostawiamy SemiBold, a resztę dajemy Regular.
Przykład: „Dlaczego **millenialsom** trudno robić marketing dla **Gen Z**?" (wyróżnione = SemiBold, reszta = Regular).

**Polska typografia:** cudzysłów „ ", angielski " "; półpauza (–) nie myślnik (-); wiszące spójniki (i, w, z, a, o, u) przerzucamy do następnej linii (twarda spacja); brak podwójnych spacji; faux bold/italic zabronione. WERSALIKI tylko w tagach/badge/eyebrow — nie w nagłówkach i treści.

**Web fallback:** `'Gilroy','Avenir Next','Avenir','Century Gothic','Segoe UI','Helvetica Neue',sans-serif`

### 2.3 Spacing / radius

Spacing (px): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, **80** (margines social), 96, 160.
Radius: `s` 8px · `m` 16px · `full` 9999 (pille, awatary). Cienie: brak (flat) — wyjątkowo tylko bardzo duże formaty.

---

## 3. Schemat generowania GRAFIKI (KV wektorowe)

### Workflow

1. **Format + tło + kontekst** (cytat ekspercki / edukacja / HR / brand statement / closing).
2. **Dobierz parę kolorów** z tabeli 3.1 (to determinuje doodle + flubber/element).
3. **Złóż hierarchię** 3.2: headline (dominanta) → drugi plan (zdjęcie/flubber) → detale (doodle + meta).
4. **Wstaw logo** wg 3.4, **assety graficzne** wg 3.3 (max 3 akcenty).
5. **Whitespace ≥ 25–30%**, margines 80px.
6. **Walidacja** §6.

### 3.1 Pary, które ZAWSZE działają ⟵ serce schematu

| Tło | Tekst | Akcent (flubber/element + doodle) | Kontekst |
|---|---|---|---|
| **dark** | beige | **ultraviolet** flubber/elem + **neon** doodle | Cytaty zarządu, eksperckie wypowiedzi |
| **dark** | beige | **neon** flubber/elem + **ultraviolet** doodle | HR, awanse, zespół |
| **beige** | black | **neon** flubber/elem + **ultraviolet** doodle | Edukacja, pytania do społeczności |
| **beige** | black | **ultraviolet** flubber/elem + **neon** doodle | Brand statements |
| **beige** | black | **dark** doodle (bez flubber/elem) | Monochrom — cytaty, czysto tekstowe |
| **neon** | black | **dark** doodle (bez flubber/elem) | High-impact, slajd zamykający karuzelę |

**Złota zasada:** doodle ZAWSZE w przeciwnym kolorze brandu niż flubber/element w tej samej kompozycji. Monochrom = tylko dark doodle, bez flubber/element.

**Pary ZAKAZANE:** tekst ultraviolet na dark · tekst neon na beige · ultraviolet jako tło z neonową typografią · doodle neon na cream · **jakikolwiek gradient**.

### 3.2 Hierarchia wizualna

1. **Dominanta:** headline (heading-split). Pierwsza rzecz, którą widać.
2. **Drugi plan:** zdjęcie osoby/produktu LUB flubber/graphic-element — równowaga, nie konkuruje z headline'em.
3. **Detale:** doodle (strzałka / kółko / podkreślenie) prowadzący wzrok do kluczowej frazy + meta (logo, hashtag, numer slajdu, autor, data).

### 3.3 Biblioteka graficzna — jak wybrać plik

Wszystko w `25wat-assets/graphic/`. SVG do digitalu, PNG fallback, `*-4x.png` do printu/dużych formatów.

| Styl | Folder | Czym jest | Kolory | Wybór |
|---|---|---|---|---|
| **doodle** | `graphic/doodle/` | Odręczne akcenty: `arrow-1/2/3`, `circles-1/2`, `sparkles(-left/right)`, `underlines-1/2`, `x-mark`. Sygnatura ZEROBULLSH!T | **dark / neon / ultraviolet** | wg pary 3.1 (przeciwny do flubbera); arrow/underline → prowadzą do frazy, circle → obwódka, x-mark → negacja |
| **flubber** | `graphic/flubber/` | Organiczne kształty, soft edges, warstwa łącząca. 5 wariantów (`1`–`5`) | **neon / ultraviolet** (brak dark) | 1,3 zwarte; 2,4 rozciągnięte; 5 płynny/duży. Nie wiesz → `flubber-{color}-1` |
| **graphic-element** | `graphic/graphic-element/` | Geometryczne, hard edges: `asterisk`, `chevrons` | **neon / ultraviolet** (brak dark) | asterisk = akcent punktujący; chevrons = ruch/kierunek/progress |

Nazewnictwo: `doodle-{kolor}-{typ}.svg`, `flubber-{kolor}-{n}.svg`, `graphic-element-{kolor}-{typ}.svg`.

**Reguły użycia:** max **3 akcenty graficzne** na kompozycję · flubber/element = warstwa łącząca, **nie wypełniacz** pustki · na tle `neon` flubber/element NIE wchodzą (tylko dark doodle) · ikony funkcjonalne = Lucide (poza tą biblioteką).

### 3.4 Logo

Pliki w `25wat-assets/logo/` (każdy SVG + PNG).

| Wariant | Plik | Kiedy |
|---|---|---|
| Primary dark | `primary-logo-25wat-dark.*` | Na jasnych tłach (default) |
| Primary light | `primary-logo-25wat-light.*` | Na ciemnych tłach |
| Mark dark | `logo-mark-25wat-dark.*` | Jasne tło, brak miejsca / na życzenie |
| Mark light | `logo-mark-25wat-light.*` | Ciemne tło, brak miejsca / na życzenie |
| wat's up dark | `watsup-logo-25wat-dark.*` | Materiały podcastu wat's up, jasne tło |
| wat's up light | `watsup-logo-25wat-light.*` | Materiały podcastu wat's up, ciemne tło |

**Pozycja:** domyślnie lewy górny róg. **Clear space:** min. 1× (X = wysokość sygnetu); wat's up min. 0,75×. **Min. rozmiar:** 24px (digital), 32px (favicon/sygnet).
**NIGDY:** obrót, nieproporcjonalne skalowanie, zmiana kolorów, efekty (cień/glow/outline/gradient), rekonstrukcja z innych elementów.

### 3.5 Wzorce (z `25wat-assets/examples/`)

- `dark-post-4_5-example-4.png` — dark + beige headline (heading-split), logo light L-góra, **neon doodle-arrow** prowadzi do nagłówka, **ultraviolet flubber** L-dół, knockout portret P. (cytat ekspercki).
- `light-post-4_5-example-8.png` — beige + black headline, **dark doodle-underline**, **neon flubber** za knockout-fotografią dwóch osób (edukacja / pytanie do społeczności).
- `presentation-title-slide.png` — beige, „Digital agency for **game changers**", logo L-góra, data L-dół, numer `01` P-dół, neon flubbery, mockup telefonu z neon asterisk + ultraviolet button.

Odwzoruj kompozycję, nie kopiuj treści.

---

## 4. Metody outputu (wybierz wg dostępności)

| Metoda | Kiedy | Jak |
|---|---|---|
| **Figma MCP** (preferowany) | Gdy MCP dostępny — idealne tokeny/fonty bez wymyślania | File key `OmM3DWO9Kr1NdFStUIDNoV`. Kolory przez bound variables (`primary/neon`, `neutral/black-500`…), text styles (`h1/Semibold`, `body`…), SVG przez `figma.createNodeFromSvg()` z `25wat-assets/`. ⚠️ Text styles mają **Inter jako placeholder** → po złożeniu: Figma Desktop → Edit → Find & Replace All Fonts → Inter → Gilroy. |
| **AI image gen** (Midjourney / Nano Banana / Flux / Seedance) | Foto­realistyczny portret/scena, abstrakcyjne tło, knockout person w flubber | Struktura promptu → §5.2 |
| **HTML/SVG** (fallback) | Szybki draft postu/banera/slajdu z typografią | Tokeny §2 jako CSS variables, padding 80px, headline Gilroy SemiBold; SVG assetów **inline** (wklej zawartość, nie `<img src>`), font-face z `25wat-assets/fonts/` |
| **Kombinacja** | Pełny deliverable | AI prompt na tło/scenę + Figma/HTML na warstwę typograficzną i graficzną (knockout + flubber + doodle + headline + logo) |

### CSS variables (gotowiec do HTML/SVG)

```css
:root{
  --neon:#D0F200; --ultraviolet:#7648F8; --neon-50:#EDFF80; --ultraviolet-50:#9C7CF8;
  --black-500:#171717; --black-300:#252525; --black-200:#454545; --black-100:#949494;
  --beige-400:#E6E1D7; --beige-300:#F2EDE3; --beige-100:#FEF9F4;
  --success:#00E658; --warning:#FFAF1A; --error:#F20045;
  --pad:80px; --radius-s:8px; --radius-m:16px;
  --font:'Gilroy','Avenir Next','Century Gothic','Segoe UI',sans-serif;
}
/* headline */ h1{font-family:var(--font);font-weight:600;font-size:64px;line-height:80px;letter-spacing:-0.01em}
.hl-regular{font-weight:400} /* nie-wyróżniona część headline'u */
```

---

## 5. Schemat generowania ZDJĘĆ (fotografia / AI)

### 5.1 Styl — TAK / NIE

**TAK:** naturalna fotografia realnych ludzi (zespół, klienci) w autentycznych sytuacjach — przy biurku, na spotkaniu, portrety z kontaktem wzrokowym · naturalne, miękkie światło dzienne · mocne, czyste kolory ubrań (pomarańcz, zielony, szary — grają z neon/ultraviolet) · realne wnętrza · **knockout** (wycięcie z tła) do osadzenia portretu w flubber shape.

**NIE:** stock „business team smiling" · ciężkie filtry IG (vintage, washed-out, winiety) · forsowane uśmiechy „na zdjęcie" · **tło w kolorach brandu** (ultraviolet/neon) · czarno-białe (chyba że temat wymaga) · duotony.

**Treatment:** domyślnie zdjęcie w **naturalnych kolorach, bez treatmentu**. Brand color wnosimy w warstwie graficznej, **NIGDY filtrem na zdjęciu.** Doodle (strzałka/kółko/podkreślenie) może być nałożony na zdjęcie jako akcent prowadzący wzrok.

### 5.2 Struktura promptu do AI image gen

```
[subject: kto/co, realna sytuacja]
+ [style: clean editorial photography, natural, brak filtrów, brak stock-vibe]
+ [palette: naturalne kolory; mocne kolory ubrań — orange/green/grey; BEZ brand-color na tle]
+ [composition: miejsce na headline + 25–30% whitespace; ew. knockout-ready, czyste tło do wycięcia]
+ [lighting: naturalne, miękkie światło dzienne]
+ [aspect ratio: 4:5 / 1:1 / 9:16 / 16:9 wg formatu §1]
```

**Przykład (portret ekspercki pod dark post 4:5):**
> Candid editorial portrait of a confident man in his 30s in a white shirt, sitting at a laptop in a real modern office, making eye contact, natural soft daylight, clean neutral background suitable for knockout, calm professional mood, no filters, no stock-photo vibe, photorealistic, 4:5. *(brand color = warstwa graficzna, nie zdjęcie)*

**Przykład (scena zespołu pod light post / HR):**
> Two real coworkers sitting outdoors on a bench, casual strong-colored clothing (red jacket, grey), looking at a phone, authentic candid moment, natural daylight, clean composition with empty space top-left for a headline, no forced smiles, photorealistic editorial, 4:5.

Wsparcie: skill `anthropic-skills:brand-image-prompt-generator` zna konwencje promptów per generator.

---

## 6. Walidacja przed oddaniem (checklist)

**Grafika:**
- [ ] Para tło + akcent jest z tabeli 3.1
- [ ] Headline = SemiBold (nie Bold), kluczowa fraza w heading-split
- [ ] Logo w wariancie pod tło (dark tło → light logo; beige tło → dark logo)
- [ ] Max 3 akcenty graficzne (doodle + flubber + element)
- [ ] Doodle w przeciwnym kolorze niż flubber/element
- [ ] Whitespace ≥ 25%, margines 80px, headline nie dotyka krawędzi
- [ ] Brak emoji w warstwie graficznej (emoji żyją tylko w copy)
- [ ] Numeracja slajdów karuzeli P-góra (01, 02…), jeśli karuzela

**Zdjęcie:**
- [ ] Naturalne kolory, zero filtra brand-color, zero duotonu/B&W
- [ ] Realna sytuacja, brak stock-vibe i forsowanych uśmiechów
- [ ] Tło NIE w kolorach brandu; (jeśli knockout) tło czyste do wycięcia
- [ ] Zostawione miejsce na headline + whitespace

---

## 7. Twarde czerwone linie (NIGDY)

- **Gradienty** — jakiekolwiek (linear, radial, mesh, soft glow, fade, color→transparent, vignette). Marka jest flat. Reguła bezwzględna.
- Ultraviolet jako tło · tekst ultraviolet na dark · tekst neon na beige (kontrast).
- Filtr brand-color na zdjęciach · brand color na tle fotografii.
- Emoji w warstwie graficznej KV.
- Nowe kolory akcentu poza paletą · inny font niż Gilroy (bez wyraźnej prośby).
- Modyfikacje logo (obrót, rozciąganie, efekty, przekolorowanie).

**Wyjątki** (wymagają akceptacji człowieka, zaznacz to w odpowiedzi): **co-branding** z klientem (jego identyfikacja prowadzi, logo 25wat jako partner w stopce — akcept. Art Director + Head of Design) · **kampanie sezonowe / niestandardowe formaty** (Walentynki, Eurowizja, 10-lecie, 16:6, animacje — akcept. Head of Design + COO).

---

## 8. Indeks assetów (`25wat-assets/`)

```
25wat-assets/
├── logo/              6 wariantów × (SVG + PNG) + usage.md
├── graphic/
│   ├── doodle/        33 SVG + 33 PNG (arrow, circles, sparkles, underlines, x-mark × dark/neon/ultraviolet)
│   ├── flubber/       10 SVG + 10 PNG (5 kształtów × neon/ultraviolet)
│   ├── graphic-element/ 4 SVG + 4 PNG (asterisk, chevrons × neon/ultraviolet)
│   └── README.md      katalog + cheatsheet decyzyjny
├── fonts/             Gilroy Light/Regular/Medium/SemiBold/ExtraBold (.otf) + typography.md
├── examples/          18 wzorcowych kompozycji (PNG)
└── dokumentacja-zrodlowa/   rules.md, tokens.md, typography.md, SKILL.md, graphic-README.md, logo-usage.md
```

> Pełne, oryginalne reguły (voice & tone, słownik UŻYWAMY/UNIKAMY, scenariusze prezentacji i copy) → `25wat-assets/dokumentacja-zrodlowa/`.
