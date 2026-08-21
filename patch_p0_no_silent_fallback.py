import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_1 = """  const designAssets = await getProjectDesignAssets(projectId);
  const brandBg = (designAssets && designAssets.colorPairs && designAssets.colorPairs.length)
    ? designAssets.colorPairs[pairIdx % designAssets.colorPairs.length]
    : null;
  const fmt = FORMATS[format] ? format : 'post-4-5';"""
assert content.count(ANCHOR_1) == 1, f"ANCHOR_1 count = {content.count(ANCHOR_1)}"

NEW_1 = """  const designAssets = await getProjectDesignAssets(projectId);
  if (projectId && Number(projectId) !== LEGACY_25WAT_PROJECT_ID) {
    const hasAnyBrandData = designAssets && (designAssets.colorPairs || designAssets.logoDataUrl || (designAssets.referenceImages && designAssets.referenceImages.length) || designAssets.aiContextText);
    if (!hasAnyBrandData) {
      return res.status(400).json({ error: 'Brak danych marki dla tego projektu (Brand Strategy / AI Context / Logo / przykladowe kompozycje). Uzupelnij Baze Wiedzy Marki przed generowaniem designu.' });
    }
  }
  const brandBg = (designAssets && designAssets.colorPairs && designAssets.colorPairs.length)
    ? designAssets.colorPairs[pairIdx % designAssets.colorPairs.length]
    : null;
  const fmt = FORMATS[format] ? format : 'post-4-5';"""

content = content.replace(ANCHOR_1, NEW_1, 1)

ANCHOR_2 = """  const designAssets = await getProjectDesignAssets(projectId);
  const activePairs = (designAssets && designAssets.colorPairs && designAssets.colorPairs.length) ? designAssets.colorPairs : pairs;
  const pair = activePairs[colorPairIdx ?? 2] || activePairs[0];"""
assert content.count(ANCHOR_2) == 1, f"ANCHOR_2 count = {content.count(ANCHOR_2)}"

NEW_2 = """  const designAssets = await getProjectDesignAssets(projectId);
  if (projectId && Number(projectId) !== LEGACY_25WAT_PROJECT_ID) {
    const hasAnyBrandData = designAssets && (designAssets.colorPairs || designAssets.logoDataUrl || (designAssets.referenceImages && designAssets.referenceImages.length) || designAssets.aiContextText);
    if (!hasAnyBrandData) {
      return res.status(400).json({ error: 'Brak danych marki dla tego projektu (Brand Strategy / AI Context / Logo / przykladowe kompozycje). Uzupelnij Baze Wiedzy Marki przed generowaniem designu.' });
    }
  }
  const activePairs = (designAssets && designAssets.colorPairs && designAssets.colorPairs.length) ? designAssets.colorPairs : pairs;
  const pair = activePairs[colorPairIdx ?? 2] || activePairs[0];"""

content = content.replace(ANCHOR_2, NEW_2, 1)

ANCHOR_3 = """    if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType === 'application/pdf') {
      try {
        const parsed = await pdfParse(fileBuffer);
        finalTextContent = (parsed.text || '').trim().slice(0, 50000);
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tekstu z PDF (moze to skan bez warstwy tekstowej).' });
        }
        fileBuffer = null;
      } catch (pdfErr) {
        console.error('pdf-parse:', pdfErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc PDF: ' + pdfErr.message });
      }
    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType !== 'text/plain' && mimeType !== 'text/markdown' && !mimeType.startsWith('text/')) {
      return res.status(400).json({ error: 'Ten kafelek przyjmuje tylko tekst (.txt, .md) lub PDF. Zdjecia wgraj w kategorii "Przyklady kompozycji" albo "Logo".' });
    }"""
assert content.count(ANCHOR_3) == 1, f"ANCHOR_3 count = {content.count(ANCHOR_3)}"

NEW_3 = """    if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType === 'application/pdf') {
      try {
        const parsed = await pdfParse(fileBuffer);
        finalTextContent = (parsed.text || '').trim().slice(0, 50000);
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tekstu z PDF (moze to skan bez warstwy tekstowej).' });
        }
        fileBuffer = null;
      } catch (pdfErr) {
        console.error('pdf-parse:', pdfErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc PDF: ' + pdfErr.message });
      }
    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType.startsWith('image/')) {
      try {
        const visionSys = 'Jestes asystentem ktory czyta zdjecia/skany dokumentow marketingowych (brand book, strategia, tone of voice, przyklady kolorow) i wypisuje z nich caly istotny tekst oraz opis wizualny (kolory - podaj dokladne kody HEX jesli da sie je odczytac lub oszacowac, fonty, styl) w czystym tekscie po polsku. Nie dodawaj wlasnych komentarzy ani ocen - tylko fakty z obrazu.';
        const visionRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: visionSys,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBuffer.toString('base64') } },
              { type: 'text', text: 'Wypisz cala tresc i opis wizualny (w tym szacowane kody HEX kolorow) tego obrazu.' }
            ] }]
          })
        });
        const visionData = await visionRes.json();
        finalTextContent = ((visionData.content || []).find(b => b.type === 'text') || {}).text || '';
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tresci z obrazu.' });
        }
        fileBuffer = null;
      } catch (visErr) {
        console.error('vision-extract:', visErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc obrazu: ' + visErr.message });
      }
    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType !== 'text/plain' && mimeType !== 'text/markdown' && !mimeType.startsWith('text/')) {
      return res.status(400).json({ error: 'Ten kafelek przyjmuje tekst (.txt, .md), PDF lub obraz (PNG/JPG).' });
    }"""

content = content.replace(ANCHOR_3, NEW_3, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: brak danych marki = blad zamiast cichego fallbacku 25wat; PNG/JPG w polach tekstowych ida przez Claude Vision")
