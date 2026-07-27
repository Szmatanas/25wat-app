from pathlib import Path

p = Path("server.js")
src = p.read_text()

start_marker = "app.post('/api/design/generate-brief'"
end_marker = "const PORT = process.env.PORT || 3001;"

start_idx = src.find(start_marker)
end_idx = src.find(end_marker)
if start_idx == -1 or end_idx == -1:
    print("BLAD: brak markerow")
    raise SystemExit(1)

line_start = src.rfind("\n", 0, start_idx) + 1

new_consts = """const ZONES = ['corner-br','corner-tr','side-right','side-left','center'];
const ALIGNS = ['top','center','bottom'];
const ACCENT_SHAPES = ['flubber-1','flubber-2','flubber-3','flubber-4','flubber-5','asterisk','chevrons'];
const PHOTO_SHAPES_FLUBBER = ['flubber','circle','rounded-square'];
const PHOTO_SHAPES_NOFLUBBER = ['circle','rounded-square'];

"""

new_handler = """app.post('/api/design/generate-brief', async (req, res) => {
  const { post, colorPairIdx, hasPhoto, format, previousZone, previousAccentShape } = req.body;
  if (!post || !post.content) return res.status(400).json({ error: 'Brak posta' });
  const pairIdx = Number.isInteger(colorPairIdx) && COLOR_PAIRS[colorPairIdx] ? colorPairIdx : 2;
  const pair = COLOR_PAIRS[pairIdx];
  const fmt = FORMATS[format] ? format : 'post-4-5';
  const hasAccent = pair.accentType === 'flubber';
  const accentChoices = hasPhoto ? (hasAccent ? PHOTO_SHAPES_FLUBBER : PHOTO_SHAPES_NOFLUBBER) : (hasAccent ? ACCENT_SHAPES : ['none']);
  const variationNote = previousZone
    ? `\\nWAZNE - REGENERACJA: poprzednio wybrales strefe "${previousZone}"${previousAccentShape ? ' i ksztalt "' + previousAccentShape + '"' : ''}. Tym razem wybierz WYRAZNIE INNA kombinacje - realna, widoczna zmiana.`
    : '';

  const sys = `Jestes Art Directorem w agencji 25wat. Projektujesz grafike social media na podstawie posta, scisle wg brand booku, z duza kreatywnoscia w kompozycji.

ZASADY (nieprzekraczalne):
- Headline max 8 slow, jedna fraza wyrozniona (heading-split).
- Marka jest flat - zero gradientow.
- Margines min. 80px.
- Doodle typy: ${DOODLE_TYPES.join(', ')}.
- Strefa kompozycji (gdzie trafia zdjecie/akcent, headline zajmuje reszte): ${ZONES.join(', ')}.
- Wyrownanie headline w swojej strefie: ${ALIGNS.join(', ')}.
- ${hasPhoto ? 'Ksztalt zdjecia: ' + accentChoices.join(', ') + '.' : (hasAccent ? 'Ksztalt akcentu: ' + accentChoices.join(', ') + ' (flubber-N to numer 1-5, lub geometryczny asterisk/chevrons).' : 'Ta para kolorow nie ma akcentu - ustaw accentShape na none.')}
- Dopasuj strefe i wyrownanie do nastroju i dlugosci headline.${variationNote}

Odpowiedz TYLKO JSON bez markdown:
{"headline":"max 8 slow po polsku","headlineHighlight":"fragment do wyroznienia (dokladny podciag)","doodleType":"jeden z: ${DOODLE_TYPES.join('|')}","zone":"jeden z: ${ZONES.join('|')}","align":"jeden z: ${ALIGNS.join('|')}","${hasPhoto ? 'photoShape' : 'accentShape'}":"jeden z: ${accentChoices.join('|')}"}`;

  try {
    const context = `Tytul posta: ${post.title || ''}\\nTyp posta: ${post.type || ''}\\nTresc posta: ${post.content}`;
    const raw = await claude(sys, context);
    const doodleType = pick(raw.doodleType, DOODLE_TYPES, 'underlines-1');
    let zone = pick(raw.zone, ZONES, ZONES[0]);
    const align = pick(raw.align, ALIGNS, 'top');
    let shapeChoice = pick(hasPhoto ? raw.photoShape : raw.accentShape, accentChoices, accentChoices[0]);

    if (previousZone && zone === previousZone && ZONES.length > 1) {
      zone = ZONES.find(z => z !== previousZone) || zone;
    }
    if (previousAccentShape && shapeChoice === previousAccentShape && accentChoices.length > 1) {
      shapeChoice = accentChoices.find(s => s !== previousAccentShape) || shapeChoice;
    }

    const headline = (raw.headline || post.title || '25wat').toString().slice(0, 120);
    const headlineHighlight = (raw.headlineHighlight || '').toString().slice(0, 60);
    const doodleFile = `doodle-${pair.doodleName}-${doodleType}.svg`;

    let accentFile = null;
    if (hasPhoto) {
      if (shapeChoice === 'flubber' && hasAccent) {
        const n = 1 + Math.floor(Math.random()*5);
        accentFile = `flubber-${pair.accentName}-${n}.svg`;
      }
    } else if (hasAccent && shapeChoice !== 'none') {
      if (shapeChoice.startsWith('flubber-')) {
        accentFile = `flubber-${pair.accentName}-${shapeChoice.split('-')[1]}.svg`;
      } else {
        accentFile = `graphic-element-${pair.accentName}-${shapeChoice}.svg`;
      }
    }
    const accentFolder = accentFile ? (accentFile.startsWith('flubber') ? 'flubber' : 'graphic-element') : null;

    res.json({
      format: fmt,
      dimensions: FORMATS[fmt],
      zone,
      align,
      accentShape: hasPhoto ? null : shapeChoice,
      photoShape: hasPhoto ? shapeChoice : null,
      background: pair.bg,
      textColor: pair.text,
      accentColor: pair.accentColor,
      doodleColor: pair.doodleColor,
      headline,
      headlineHighlight,
      hasPhoto: !!hasPhoto,
      assets: {
        doodle: `/assets/graphic/doodle/${doodleFile}`,
        accent: accentFile ? `/assets/graphic/${accentFolder}/${accentFile}` : null,
        logo: pair.bgName === 'dark' ? '/assets/logo/primary-logo-25wat-light.svg' : '/assets/logo/primary-logo-25wat-dark.svg',
      }
    });
  } catch(e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

"""

src = src[:line_start] + new_consts + new_handler + src[end_idx:]
p.write_text(src)
print("OK, linie:", len(src.splitlines()))
