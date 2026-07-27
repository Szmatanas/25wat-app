from pathlib import Path

p = Path("server.js")
src = p.read_text()
changes = []

old1 = "const { post, colorPairIdx, hasPhoto, format } = req.body;"
new1 = "const { post, colorPairIdx, hasPhoto, format, previousLayout, previousFlubberShape } = req.body;"
if old1 in src:
    src = src.replace(old1, new1, 1)
    changes.append("1 OK")
else:
    changes.append("1 BRAK")

old2 = "const allowedLayouts = hasPhoto ? LAYOUTS_WITH_PHOTO : LAYOUTS_NO_PHOTO;"
new2 = old2 + """
  const variationNote = previousLayout
    ? `\\nWAZNE - REGENERACJA: poprzednim razem wybrales layout "${previousLayout}"${previousFlubberShape ? ' i ksztalt flubbera ' + previousFlubberShape : ''}. Tym razem wybierz WYRAZNIE INNY layout${pair.accentType === 'flubber' ? ' i inny ksztalt flubbera' : ''} - realna, widoczna zmiana, nie kosmetyka.`
    : '';"""
if old2 in src:
    src = src.replace(old2, new2, 1)
    changes.append("2 OK")
else:
    changes.append("2 BRAK")

old3 = "dla mocniejszych, bardziej dynamicznych."
new3 = "dla mocniejszych, bardziej dynamicznych.${variationNote}"
if old3 in src:
    src = src.replace(old3, new3, 1)
    changes.append("3 OK")
else:
    changes.append("3 BRAK")

old4 = """const flubberShape = pick(Number(raw.flubberShape), FLUBBER_SHAPES, 1);
    const layout = pick(raw.layout, allowedLayouts, allowedLayouts[0]);"""
new4 = """let flubberShape = pick(Number(raw.flubberShape), FLUBBER_SHAPES, 1);
    let layout = pick(raw.layout, allowedLayouts, allowedLayouts[0]);
    if (previousLayout && layout === previousLayout && allowedLayouts.length > 1) {
      layout = allowedLayouts.find(l => l !== previousLayout) || layout;
    }
    if (previousFlubberShape && flubberShape === Number(previousFlubberShape)) {
      flubberShape = ((Number(previousFlubberShape) % FLUBBER_SHAPES.length) + 1);
    }"""
if old4 in src:
    src = src.replace(old4, new4, 1)
    changes.append("4 OK")
else:
    changes.append("4 BRAK")

old5 = "layout,\n      background: pair.bg,"
new5 = "layout,\n      flubberShape,\n      background: pair.bg,"
if old5 in src:
    src = src.replace(old5, new5, 1)
    changes.append("5 OK")
else:
    changes.append("5 BRAK")

p.write_text(src)
print(" | ".join(changes))
