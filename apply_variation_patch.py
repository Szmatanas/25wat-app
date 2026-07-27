import re
from pathlib import Path

p = Path("server.js")
src = p.read_text()

old_handler = """app.post('/api/design/generate-brief', async (req, res) => {
  const { post, colorPairIdx, hasPhoto, format } = req.body;
  if (!post || !post.content) return res.status(400).json({ error: 'Brak posta' });
  const pairIdx = Number.isInteger(colorPairIdx) && COLOR_PAIRS[colorPairIdx] ? colorPairIdx : 2;
  const pair = COLOR_PAIRS[pairIdx];
  const fmt = FORMATS[format] ? format : 'post-4-5';
  const allowedLayouts = hasPhoto ? LAYOUTS_WITH_PHOTO : LAYOUTS_NO_PHOTO;

  const sys = `Jestes Art Directorem w agencji 25wat. Projektujesz grafike social media na podstawie posta, scisle wg brand booku, ale z realna kreatywnoscia w kompozycji - kazdy projekt ma wygladac inaczej, dopasowany do tresci i nastroju posta.

ZASADY (nieprzekraczalne):
- Headline to najwazniejszy element. Max 8 slow, jedna kluczowa fraza wyrozniona (heading-split).
- Marka jest flat - zero gradientow, tylko plaskie kolory.
- Margines min. 80px z kazdej strony.
- Doodle dostepne typy: ${DOODLE_TYPES.join(', ')} - wybierz jeden pasujacy do tonu posta.
- ${pair.accentType === 'flubber' ? 'Ksztalt flubber: wybierz numer 1-5 (1,3=zwarte/okragle, 2,4=rozciagniete/asymetryczne, 5=najbardziej plynny).' : 'Ta para kolorow nie uzywa flubbera - tylko doodle.'}
- Uklad kompozycji do wyboru: ${allowedLayouts.join(' LUB ')}. Wybierz ten, ktory lepiej pasuje do nastroju/dlugosci headline - "top-heavy"/"photo-bottom" dla spokojnych, informacyjnych postow, "center-split"/"photo-side" dla mocniejszych, bardziej dynamicznych.

Odpowiedz TYLKO JSON bez markdown:
{"headline":"max 8 slow po polsku","headlineHighlight":"fragment headline do wyroznienia (dokladny podciag)","doodleType":"jeden z: ${DOODLE_TYPES.join('|')}","flubberShape":1,"layout":"jeden z: ${allowedLayouts.join('|')}"}`;

  try {
    const context = `Tytul posta: ${post.title || ''}\\nTyp posta: ${post.type || ''}\\nTresc posta: ${post.content}`;
    const raw = await claude(sys, context);
    const doodleType = pick(raw.doodleType, DOODLE_TYPES, 'underlines-1');
    const flubberShape = pick(Number(raw.flubberShape), FLUBBER_SHAPES, 1);
    const layout = pick(raw.layout, allowedLayouts, allowedLayouts[0]);
    const headline = (raw.headline || post.title || '25wat').toString().slice(0, 120);"""

new_handler = """app.post('/api/design/generate-brief', async (req, res) => {
  const { post, colorPairIdx, hasPhoto, format, previousLayout, previousFlubberShape } = req.body;
  if (!post || !post.content) return res.status(400).json({ error: 'Brak posta' });
  const pairIdx = Number.isInteger(colorPairIdx) && COLOR_PAIRS[colorPairIdx] ? colorPairIdx : 2;
  const pair = COLOR_PAIRS[pairIdx];
  const fmt = FORMATS[format] ? format : 'post-4-5';
  const allowedLayouts = hasPhoto ? LAYOUTS_WITH_PHOTO : LAYOUTS_NO_PHOTO;
  const variationNote = previousLayout
    ? `\\nWAZNE - REGENERACJA: poprzednim razem wybrales layout "${previousLayout}"${previousFlubberShape ? ' i ksztalt flubbera ' + previousFlubberShape : ''}. Tym razem wybierz WYRAZNIE INNY layout${pair.accentType === 'flubber' ? ' i inny ksztalt flubbera' : ''} - realna, widoczna zmiana, nie kosmetyka.`
    : '';

  const sys = `Jestes Art Directorem w agencji 25wat. Projektujesz grafike social media na podstawie posta, scisle wg brand booku, ale z realna kreatywnoscia w kompozycji - kazdy projekt ma wygladac inaczej, dopasowany do tresci i nastroju posta.

ZASADY (nieprzekraczalne):
- Headline to najwazniejszy element. Max 8 slow, jedna kluczowa fraza wyrozniona (heading-split).
- Marka jest flat - zero gradientow, tylko plaskie kolory.
- Margines min. 80px z kazdej strony.
- Doodle dostepne typy: ${DOODLE_TYPES.join(', ')} - wybierz jeden pasujacy do tonu posta.
- ${pair.accentType === 'flubber' ? 'Ksztalt flubber: wybierz numer 1-5 (1,3=zwarte/okragle, 2,4=rozciagniete/asymetryczne, 5=najbardziej plynny).' : 'Ta para kolorow nie uzywa flubbera - tylko doodle.'}
- Uklad kompozycji do wyboru: ${allowedLayouts.join(' LUB ')}. Wybierz ten, ktory lepiej pasuje do nastroju/dlugosci headline - "top-heavy"/"photo-bottom" dla spokojnych, informacyjnych postow, "center-split"/"photo-side" dla mocniejszych, bardziej dynamicznych.${variationNote}

Odpowiedz TYLKO JSON bez markdown:
{"headline":"max 8 slow po polsku","headlineHighlight":"fragment headline do wyroznienia (dokladny podciag)","doodleType":"jeden z: ${DOODLE_TYPES.join('|')}","flubberShape":1,"layout":"jeden z: ${allowedLayouts.join('|')}"}`;

  try {
    const context = `Tytul posta: ${post.title || ''}\\nTyp posta: ${post.type || ''}\\nTresc posta: ${post.content}`;
    const raw = await claude(sys, context);
    const doodleType = pick(raw.doodleType, DOODLE_TYPES, 'underlines-1');
    let flubberShape = pick(Number(raw.flubberShape), FLUBBER_SHAPES, 1);
    let layout = pick(raw.layout, allowedLayouts, allowedLayouts[0]);
    // Wymuszona roznorodnosc - jesli model i tak wybral to samo co poprzednio, wymuszamy zmiane server-side
    if (previousLayout && layout === previousLayout && allowedLayouts.length > 1) {
      layout = allowedLayouts.find(l => l !== previousLayout) || layout;
    }
    if (previousFlubberShape && flubberShape === Number(previousFlubberShape)) {
      flubberShape = ((Number(previousFlubberShape) % FLUBBER_SHAPES.length) + 1);
    }
    const headline = (raw.headline || post.title || '25wat').toString().slice(0, 120);"""

if old_handler not in src:
    print("BLAD: nie znaleziono dokladnego dopasowania - sprawdz plik recznie")
    raise SystemExit(1)

src = src.replace(old_handler, new_handler)
src = src.replace(
    'layout,\n      background: pair.bg,',
    'layout,\n      flubberShape,\n      background: pair.bg,'
)
p.write_text(src)
print("OK. Linie po zmianie:", len(src.splitlines()))
