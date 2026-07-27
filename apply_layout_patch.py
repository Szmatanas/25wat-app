import re
from pathlib import Path

p = Path("server.js")
src = p.read_text()

start_marker = "// ── Design generation: pary kolorow"
end_marker = "const PORT = process.env.PORT || 3001;"

start_idx = src.find(start_marker)
end_idx = src.find(end_marker)
if start_idx == -1 or end_idx == -1:
    print("BŁĄD: nie znaleziono markerów, sprawdź plik ręcznie")
    raise SystemExit(1)

new_block = '''// ── Design generation: pary kolorow (na sztywno, z rules.md) ──
const COLOR_PAIRS = [
  { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accentColor: '#7648F8', accentName: 'ultraviolet', doodleColor: '#D0F200', doodleName: 'neon', accentType: 'flubber' },
  { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accentColor: '#D0F200', accentName: 'neon', doodleColor: '#7648F8', doodleName: 'ultraviolet', accentType: 'flubber' },
  { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accentColor: '#D0F200', accentName: 'neon', doodleColor: '#7648F8', doodleName: 'ultraviolet', accentType: 'flubber' },
  { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accentColor: '#7648F8', accentName: 'ultraviolet', doodleColor: '#D0F200', doodleName: 'neon', accentType: 'flubber' },
  { bg: '#D0F200', bgName: 'neon', text: '#171717', accentColor: null, accentName: null, doodleColor: '#171717', doodleName: 'dark', accentType: 'none' },
];
const DOODLE_TYPES = ['arrow-1','arrow-2','arrow-3','circles-1','circles-2','underlines-1','underlines-2','sparkles','x-mark'];
const FLUBBER_SHAPES = [1,2,3,4,5];
const FORMATS = {
  'post-1-1': { w: 1080, h: 1080, label: 'Feed 1:1' },
  'post-4-5': { w: 1080, h: 1350, label: 'Feed 4:5' },
  'story': { w: 1080, h: 1920, label: 'Story 9:16' },
};
const LAYOUTS_NO_PHOTO = ['top-heavy', 'center-split'];
const LAYOUTS_WITH_PHOTO = ['photo-bottom', 'photo-side'];
function pick(value, allowed, fallback) { return allowed.includes(value) ? value : fallback; }

app.post('/api/design/generate-brief', async (req, res) => {
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
    const context = `Tytul posta: ${post.title || ''}\nTyp posta: ${post.type || ''}\nTresc posta: ${post.content}`;
    const raw = await claude(sys, context);
    const doodleType = pick(raw.doodleType, DOODLE_TYPES, 'underlines-1');
    const flubberShape = pick(Number(raw.flubberShape), FLUBBER_SHAPES, 1);
    const layout = pick(raw.layout, allowedLayouts, allowedLayouts[0]);
    const headline = (raw.headline || post.title || '25wat').toString().slice(0, 120);
    const headlineHighlight = (raw.headlineHighlight || '').toString().slice(0, 60);
    const doodleFile = `doodle-${pair.doodleName}-${doodleType}.svg`;
    const accentFile = pair.accentType === 'flubber' ? `flubber-${pair.accentName}-${flubberShape}.svg` : null;

    res.json({
      format: fmt,
      dimensions: FORMATS[fmt],
      layout,
      background: pair.bg,
      textColor: pair.text,
      accentColor: pair.accentColor,
      doodleColor: pair.doodleColor,
      headline,
      headlineHighlight,
      hasPhoto: !!hasPhoto,
      assets: {
        doodle: `/assets/graphic/doodle/${doodleFile}`,
        accent: accentFile ? `/assets/graphic/flubber/${accentFile}` : null,
        logo: pair.bgName === 'dark' ? '/assets/logo/primary-logo-25wat-light.svg' : '/assets/logo/primary-logo-25wat-dark.svg',
      }
    });
  } catch(e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

'''

src = src[:start_idx] + new_block + src[end_idx:]
p.write_text(src)
print("Podmienione. Nowa dlugosc pliku:", len(src.splitlines()), "linii")
