# 25wat — typografia

Wartości liczbowe (skala) → `tokens.md`.
Tutaj: jakie fonty, kiedy je stosować, jak parować, jak łamać tekst.

---

## Fonty

25wat używa **jednej rodziny** — **Gilroy** — zarówno do display, jak i do treści. Brak osobnego fontu body.

### Gilroy (display + body)

- **Rodzina:** Gilroy
- **Foundry / dystrybutor:** Type Department / Radomir Tinkov
- **Licencja:** komercyjna (zakupiona przez 25wat — pozwala na użycie w materiałach agencji i klientów)
- **Pliki w `fonts/`:**
  - `Gilroy-Light.otf` (300)
  - `Gilroy-Regular.otf` (400)
  - `Gilroy-Medium.otf` (500)
  - `Gilroy-SemiBold.otf` (600)
  - `Gilroy-ExtraBold.otf` (700 — w 25wat nazywany "Bold")
- **Web fallback (CSS):** `'Gilroy', 'Avenir Next', 'Avenir', 'Century Gothic', 'Segoe UI', 'Helvetica Neue', sans-serif`

---

## Wagi w użyciu

| Waga | Numerycznie | Zastosowanie |
|---|---|---|
| Light | 300 | Używać tylko wtedy, jeśli tło jest ciemne |
| Regular | 400 | Jako główny tekst lub podpisy |
| Medium | 500 | Używać tylko wtedy, kiedy użytkownik o to poprosi |
| Semibold | 600 | Jako nagłowki, headliny, wyboldowania |
| Bold | 700 | Używać tylko wtedy, kiedy użytkownik o to poprosi |

---

## Zasady budowania nagłówków

Nagłówki lub tytuły budujemy w taki sposób że wykorzystujmy głównie wagę Semibold, ale w momęcie jak jest możliwość wyróńnieia jakiejś części tekstu kożystamy również z wagi regular dla przykładu: nagłówek "Real brands. Real results. See how we did it." (Real brands. Real results. - regular, See how we did it - Semibold lub "Widoczność w modelach AI to nie tylko rewolucja w SEO. To rewolucja w prospectingu." Widoczność w modelach AI to nie tylko rewolucja w SEO. - regular, To rewolucja w prospectingu. - Semibold)

---

## Hierarchia (skrót — pełna skala w `tokens.md`)

| Poziom | Font | Waga | Notatka |
|---|---|---|---|
| Display / KV title | Gilroy | Semibold |  |
| H1 | Gilroy | Semibold |  |
| H2 | Gilroy | Semibold |  |
| H3 | Gilroy | Semibold |  |
| Body | Gilroy | Regular |  |
| Caption / meta | Gilroy | Regular |  |
| Button / UI label | Gilroy | Regular |  |

---

## Zasady łamania i typografii polskiej

- [ ] Wiszące spójniki (i, w, z, a, o, u) — przerzucamy do następnej linii (twarda spacja)
- [ ] Cudzysłów polski: „...” (nie "..." i nie „..")
- [ ] Półpauza (–), nie myślnik (-), w zdaniach wtrąconych
- [ ] Brak podwójnych spacji
- [ ] (dodaj swoje)

---

## Zastosowania szczególne

### Cytaty

W polskich treściach Używamy cudzysłowów „ ” w angielskich “ ”

### Liczby / dane

Bez specialnego traktowania

### Wersaliki

WERSALIKI używamy przy tagach, badge, Overline, Etykieta, Eyebrow/Nadtytuł. NIE używamy np. przy nagłówkach, regularnym tekscie, długich treściach

---

## Czego NIE robić

- [ ] Używaj tylko rodziny Gilroy no jedynie że użytkownik zażąda inaczej 
- [ ] Nie używać sztucznego pogrubienia / kursywy (faux bold/italic)
