# 25wat — graphic elements (katalog)

Trzy współistniejące style graficzne brandu. Pełne zasady stosowania → `../rules.md` (sekcje "Zasady kolorystyki" oraz "Ikonografia / ilustracje").

Tu: **co jest w folderach** i **jak wybrać konkretny plik**.

---

## Struktura folderów

```
graphic/
├── doodle/            ← odręczne, ekspresyjne (sygnatura ZEROBULLSH!T)
├── flubber/           ← organiczne kształty, soft edges
└── graphic-element/   ← geometryczne, hard edges
```

---

## doodle/ — odręczne akcenty

Działanie: prowadzą oko do kluczowej frazy, podkreślają, podsumowują. Używane oszczędnie (1–3 per kompozycja).

### Typy

| Typ | Plik (przykład) | Zastosowanie |
|---|---|---|
| `arrow-1`, `arrow-2`, `arrow-3` | `doodle-{color}-arrow-{n}.svg` | Strzałki — prowadzą wzrok między elementami |
| `circles-1`, `circles-2` | `doodle-{color}-circles-{n}.svg` | Okrąg / obwódka wokół kluczowej frazy |
| `sparkles`, `sparkles-left`, `sparkles-right` | `doodle-{color}-sparkles{-side}.svg` | Iskierki — akcent "uwaga, fajne" |
| `underlines-1`, `underlines-2` | `doodle-{color}-underlines-{n}.svg` | Podkreślenia pod frazą kluczową |
| `x-mark` | `doodle-{color}-x-mark.svg` | Negacja, "nie tak", przekreślenie |

### Warianty kolorystyczne (każdy typ ma 3 wersje)

| Kolor | Kiedy używać |
|---|---|
| `dark` (#171717) | Stonowane, monochromatyczne kompozycje: **Beige + Black + dark doodle**, **Neon + Black + dark doodle** |
| `neon` (#D0F200) | Na tle `dark` z **ultraviolet** flubber/graphic-element; LUB na tle `beige` z **ultraviolet** flubber/graphic-element |
| `ultraviolet` (#7648F8) | Na tle `dark` z **neon** flubber/graphic-element; LUB na tle `beige` z **neon** flubber/graphic-element |

### Zasada parowania (z `rules.md`)

> Doodle ZAWSZE jest w **przeciwnym kolorze brandu** niż flubber/graphic-element w tej samej kompozycji. Wyjątek: kompozycje monochromatyczne — wtedy używamy tylko `dark` doodle, bez flubber/graphic-element.

### Pliki o nazwie `*-4x.png`

Eksporty PNG w wysokiej rozdzielczości (×4) — dla zastosowań print / big format. Do digitala wystarczy zwykły PNG lub SVG.

---

## flubber/ — organiczne kształty

Działanie: warstwa łącząca tło z elementem typograficznym lub fotografią. **Nigdy** jako wypełniacz pustej przestrzeni.

### Co jest

5 wariantów kształtu (`flubber-{color}-1` do `flubber-{color}-5`) w 2 kolorach (neon, ultraviolet).

**Brak wariantu dark** — flubber zawsze jest brand-kolorem (neon LUB ultraviolet).

### Wybór kształtu (1–5)

Numerki to różne sylwetki organicznych form. Brak ścisłej reguły "1 = wstęp, 2 = środek". Wybór wg rytmu kompozycji:

- **flubber-1, flubber-3** — bardziej zwarte, "okrągłe"
- **flubber-2, flubber-4** — bardziej rozciągnięte / asymetryczne
- **flubber-5** — najbardziej "płynny", do większych kompozycji

> Jeśli nie wiesz który — `flubber-{color}-1` to bezpieczny default.

### Wybór koloru

Wg tabeli "Pary, które ZAWSZE działają" w `rules.md`:
- na tle `dark` → ultraviolet **lub** neon (dobierane do kontekstu)
- na tle `beige` → ultraviolet **lub** neon (dobierane do kontekstu)
- na tle `neon` → flubber **nie wchodzi** (używamy tylko dark doodle)

---

## graphic-element/ — geometryczne akcenty

Działanie: jak flubber (warstwa łącząca), ale **ostre krawędzie**, czyste kształty geometryczne.

### Co jest

| Typ | Plik | Zastosowanie |
|---|---|---|
| `asterisk` | `graphic-element-{color}-asterisk.svg` | Gwiazdka / sygnatura — akcent punktujący |
| `chevrons` | `graphic-element-{color}-chevrons.svg` | Strzałki/szewrony — ruch, kierunek, progress |

Każdy w 2 kolorach: **neon**, **ultraviolet**. **Brak wariantu dark.**

### Wybór koloru

Identycznie jak dla flubber — patrz tabela "Pary, które ZAWSZE działają" w `rules.md`.

---

## Cheatsheet (skrót decyzyjny)

**1. Wybierz tło** (`dark` / `beige` / `neon`).
**2. Sprawdź tabelę "Pary, które ZAWSZE działają"** w `rules.md`.
**3. Dobierz parę** flubber/graphic-element + doodle wg kolumny "Akcent" dla danego kontekstu.

| Tło | Doodle | Flubber/graphic-element |
|---|---|---|
| `dark` | `neon` lub `ultraviolet` (przeciwny do flubber) | `ultraviolet` lub `neon` |
| `beige` | `neon` lub `ultraviolet` (przeciwny do flubber) | `ultraviolet` lub `neon` |
| `beige` | `dark` (monochrom) | — (brak) |
| `neon`  | `dark` (high-impact) | — (brak) |

---

## Format plików

- **SVG** — do wszystkiego digital (web, social, prezentacje skalowalne). Mały rozmiar, ostre krawędzie w każdej skali.
- **PNG** — fallback dla narzędzi, które nie czytają SVG (niektóre exporty social/edytory).
- **`*-4x.png`** — wysoka rozdzielczość, do print / dużych formatów.
