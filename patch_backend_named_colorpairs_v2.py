import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_1 = """    const hexMatches = [...new Set((aiContextText.match(/#[0-9A-Fa-f]{6}/g) || []).map(h => h.toUpperCase()))];
    let colorPairs = null;
    if (hexMatches.length >= 2) {
      const c0 = hexMatches[0], c1 = hexMatches[1], c2 = hexMatches[2] || hexMatches[0];
      colorPairs = [
        { bg: c0, bgName: 'primary', text: c1, accent: c2, accentName: 'accent' },
        { bg: c1, bgName: 'secondary', text: c0, accent: c2, accentName: 'accent' }
      ];
    }"""
assert content.count(ANCHOR_1) == 1, f"ANCHOR_1 count = {content.count(ANCHOR_1)}"
NEW_1 = """    const namedColorRe = /\\*\\*([^*\\n]{2,40}?)\\*\\*\\s*`(#[0-9A-Fa-f]{6})`/g;
    const namedColors = [];
    const seenHex = new Set();
    let ncMatch;
    while ((ncMatch = namedColorRe.exec(aiContextText)) !== null) {
      const hex = ncMatch[2].toUpperCase();
      if (seenHex.has(hex)) continue;
      seenHex.add(hex);
      namedColors.push({ name: ncMatch[1].trim(), hex });
      if (namedColors.length >= 8) break;
    }
    const hexMatches = [...new Set((aiContextText.match(/#[0-9A-Fa-f]{6}/g) || []).map(h => h.toUpperCase()))];
    let colorPairs = null;
    if (namedColors.length >= 2) {
      const white = namedColors.find(c => c.hex === '#FFFFFF');
      const primary = namedColors[0];
      const accents = namedColors.slice(1).filter(c => c.hex !== '#FFFFFF');
      colorPairs = accents.slice(0, 4).map(acc => ({
        bg: primary.hex, bgName: primary.name, text: white ? white.hex : '#FFFFFF',
        accent: acc.hex, accentName: acc.name, name: primary.name + ' + ' + acc.name
      }));
      if (white && accents[0]) {
        colorPairs.push({ bg: white.hex, bgName: white.name, text: primary.hex, accent: accents[0].hex, accentName: accents[0].name, name: white.name + ' + ' + primary.name });
      }
      if (!colorPairs.length) colorPairs = null;
    } else if (hexMatches.length >= 2) {
      const c0 = hexMatches[0], c1 = hexMatches[1], c2 = hexMatches[2] || hexMatches[0];
      colorPairs = [
        { bg: c0, bgName: 'primary', text: c1, accent: c2, accentName: 'accent', name: 'Wariant 1' },
        { bg: c1, bgName: 'secondary', text: c0, accent: c2, accentName: 'accent', name: 'Wariant 2' }
      ];
    }"""
content = content.replace(ANCHOR_1, NEW_1, 1)

ANCHOR_2 = """    return { brandName, logoDataUrl, referenceImages, aiContextText, colorPairs };
  } catch (e) {
    console.error('getProjectDesignAssets:', e.message);
    return null;
  }
}"""
assert content.count(ANCHOR_2) == 1, f"ANCHOR_2 count = {content.count(ANCHOR_2)}"
NEW_2 = """    return { brandName, logoDataUrl, referenceImages, aiContextText, colorPairs };
  } catch (e) {
    console.error('getProjectDesignAssets:', e.message);
    return null;
  }
}

app.get('/api/projects/:projectId/color-pairs', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const designAssets = await getProjectDesignAssets(req.projectId);
    res.json({ colorPairs: (designAssets && designAssets.colorPairs) ? designAssets.colorPairs : null });
  } catch (e) {
    console.error('color-pairs:', e.message);
    res.status(500).json({ error: e.message });
  }
});"""
content = content.replace(ANCHOR_2, NEW_2, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: getProjectDesignAssets wyciaga nazwane kolory + nowy endpoint GET /api/projects/:id/color-pairs")
