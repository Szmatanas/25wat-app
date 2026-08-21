import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_1 = """async function getProjectBrandContext(projectId) {
  if (!projectId) return null;
  if (Number(projectId) === LEGACY_25WAT_PROJECT_ID) return null;
  try {
    const result = await pool.query(
      "SELECT category, text_content FROM brand_assets WHERE project_id = $1 AND category IN ('brand_context','tone_of_voice','ai_context','ai_context_rules') AND text_content IS NOT NULL ORDER BY created_at DESC",
      [projectId]
    );
    if (!result.rows.length) return null;
    const byCat = {};
    result.rows.forEach(r => { if (!byCat[r.category]) byCat[r.category] = r.text_content; });
    const parts = [];
    if (byCat.ai_context_rules) parts.push('TWOJE WYTYCZNE (zawsze obowiazujace, nadrzedne wobec reszty):\\n' + byCat.ai_context_rules);
    if (byCat.brand_context) parts.push('BRAND STRATEGY:\\n' + byCat.brand_context);
    if (byCat.tone_of_voice) parts.push('TONE OF VOICE:\\n' + byCat.tone_of_voice);
    if (byCat.ai_context) parts.push('AI CONTEXT (design, konkurencja):\\n' + byCat.ai_context);
    return parts.length ? parts.join('\\n\\n') : null;
  } catch (e) {
    console.error('getProjectBrandContext:', e.message);
    return null;
  }
}"""
assert content.count(ANCHOR_1) == 1, f"ANCHOR_1 count = {content.count(ANCHOR_1)}"

NEW_1 = ANCHOR_1 + """

async function getProjectDesignAssets(projectId) {
  if (!projectId || Number(projectId) === LEGACY_25WAT_PROJECT_ID) return null;
  try {
    const projRes = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    const brandName = projRes.rows[0] ? projRes.rows[0].name : null;

    const logoRes = await pool.query(
      "SELECT file_data, mime_type FROM brand_assets WHERE project_id = $1 AND category = 'logo' AND file_data IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const refRes = await pool.query(
      "SELECT file_data, mime_type FROM brand_assets WHERE project_id = $1 AND category = 'reference_designs' AND file_data IS NOT NULL ORDER BY created_at DESC LIMIT 4",
      [projectId]
    );
    const ctxRes = await pool.query(
      "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'ai_context' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const aiContextText = ctxRes.rows[0] ? ctxRes.rows[0].text_content : '';

    const hexMatches = [...new Set((aiContextText.match(/#[0-9A-Fa-f]{6}/g) || []).map(h => h.toUpperCase()))];
    let colorPairs = null;
    if (hexMatches.length >= 2) {
      const c0 = hexMatches[0], c1 = hexMatches[1], c2 = hexMatches[2] || hexMatches[0];
      colorPairs = [
        { bg: c0, bgName: 'primary', text: c1, accent: c2, accentName: 'accent' },
        { bg: c1, bgName: 'secondary', text: c0, accent: c2, accentName: 'accent' }
      ];
    }

    const logoRow = logoRes.rows[0] || null;
    const logoDataUrl = logoRow ? `data:${logoRow.mime_type || 'image/png'};base64,${logoRow.file_data.toString('base64')}` : null;
    const referenceImages = refRes.rows.map(r => ({ base64: r.file_data.toString('base64'), mime: r.mime_type || 'image/png' }));

    return { brandName, logoDataUrl, referenceImages, aiContextText, colorPairs };
  } catch (e) {
    console.error('getProjectDesignAssets:', e.message);
    return null;
  }
}"""

content = content.replace(ANCHOR_1, NEW_1, 1)

ANCHOR_2 = """    const customBrandContext = await getProjectBrandContext(projectId);
    const systemPrompt = customBrandContext
      ? customBrandContext + '\\n\\n---\\n\\nPisz posty na Facebook po polsku, zgodnie z powyzszym kontekstem marki (strategia, tone of voice).'
      : BRAND_VOICE;
    const prompt = `Napisz 4 rozne propozycje postow na Facebook dla agencji 25wat na temat: "${topic}"."""
assert content.count(ANCHOR_2) == 1, f"ANCHOR_2 count = {content.count(ANCHOR_2)}"

NEW_2 = """    const customBrandContext = await getProjectBrandContext(projectId);
    const systemPrompt = customBrandContext
      ? customBrandContext + '\\n\\n---\\n\\nPisz posty na Facebook po polsku, zgodnie z powyzszym kontekstem marki (strategia, tone of voice).'
      : BRAND_VOICE;
    let brandLabel = 'agencji 25wat';
    if (projectId && Number(projectId) !== LEGACY_25WAT_PROJECT_ID) {
      try {
        const projRes = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
        if (projRes.rows[0] && projRes.rows[0].name) brandLabel = 'marki ' + projRes.rows[0].name;
      } catch (e) { console.error('brandLabel lookup:', e.message); }
    }
    const prompt = `Napisz 4 rozne propozycje postow na Facebook dla ${brandLabel} na temat: "${topic}"."""

content = content.replace(ANCHOR_2, NEW_2, 1)

ANCHOR_3 = """app.post('/api/design/generate-brief', async (req, res) => {
  const { post, colorPairIdx, hasPhoto, format, previousZone, previousAccentShape } = req.body;
  if (!post || !post.content) return res.status(400).json({ error: 'Brak posta' });
  const pairIdx = Number.isInteger(colorPairIdx) && COLOR_PAIRS[colorPairIdx] ? colorPairIdx : 2;
  const pair = COLOR_PAIRS[pairIdx];
  const fmt = FORMATS[format] ? format : 'post-4-5';"""
assert content.count(ANCHOR_3) == 1, f"ANCHOR_3 count = {content.count(ANCHOR_3)}"

NEW_3 = """app.post('/api/design/generate-brief', async (req, res) => {
  const { post, colorPairIdx, hasPhoto, format, previousZone, previousAccentShape, projectId } = req.body;
  if (!post || !post.content) return res.status(400).json({ error: 'Brak posta' });
  const pairIdx = Number.isInteger(colorPairIdx) && COLOR_PAIRS[colorPairIdx] ? colorPairIdx : 2;
  const pair = COLOR_PAIRS[pairIdx];
  const designAssets = await getProjectDesignAssets(projectId);
  const brandBg = (designAssets && designAssets.colorPairs && designAssets.colorPairs.length)
    ? designAssets.colorPairs[pairIdx % designAssets.colorPairs.length]
    : null;
  const fmt = FORMATS[format] ? format : 'post-4-5';"""

content = content.replace(ANCHOR_3, NEW_3, 1)

ANCHOR_3B = """      background: pair.bg,
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
    });"""
assert content.count(ANCHOR_3B) == 1, f"ANCHOR_3B count = {content.count(ANCHOR_3B)}"

NEW_3B = """      background: brandBg ? brandBg.bg : pair.bg,
      textColor: brandBg ? brandBg.text : pair.text,
      accentColor: pair.accentColor,
      doodleColor: pair.doodleColor,
      headline,
      headlineHighlight,
      hasPhoto: !!hasPhoto,
      assets: {
        doodle: `/assets/graphic/doodle/${doodleFile}`,
        accent: accentFile ? `/assets/graphic/${accentFolder}/${accentFile}` : null,
        logo: (designAssets && designAssets.logoDataUrl) ? designAssets.logoDataUrl : (pair.bgName === 'dark' ? '/assets/logo/primary-logo-25wat-light.svg' : '/assets/logo/primary-logo-25wat-dark.svg'),
      }
    });"""

content = content.replace(ANCHOR_3B, NEW_3B, 1)

ANCHOR_4 = """app.post('/api/design/generate-image', async (req, res) => {
  const { post, colorPairIdx, userPhoto, photoDescription, hasPhoto, customHeadline, styleNote, format } = req.body;
  if (!post) return res.status(400).json({ error: 'Brak posta' });
  const OPENAI_KEY = process.env.OPENAI_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'Brak OPENAI_KEY na serwerze' });

  const pairs = [
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#D0F200', bgName: 'neon', text: '#171717', accent: '#171717', accentName: 'dark' }
  ];
  const pair = pairs[colorPairIdx ?? 2] || pairs[2];
  const wantsPhoto = hasPhoto !== false && !!userPhoto;

  const SIZE_MAP = { 'post-1-1': '1024x1024', 'post-4-5': '1024x1536', 'story': '1024x1536' };
  const size = SIZE_MAP[format] || '1024x1536';

  const DARK_REFS = ['dark-post-4_5-example-4.png', 'dark-post-square-example-1.png', 'dark-post-square-example-2.png', 'dark-post-square-example-3.png'];
  const LIGHT_REFS = ['light-post-4_5-example-8.png', 'light-post-square-example-5.png', 'light-post-square-example-6.png', 'light-post-square-example-7.png'];
  const references = pair.bgName === 'dark' ? DARK_REFS : LIGHT_REFS;

  try {
    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/schemat/schemat.md');
    const schemaText = fs.readFileSync(schemaPath, 'utf8');
    const EXAMPLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/examples');

    const postText = `Tytul: ${post.title || ''}\\n${post.content || ''}`;

    const colorInstruction = `UZYJ DOKLADNIE tej pary kolorow, nie wybieraj innej z tabeli w schemacie: tlo ${pair.bg} (${pair.bgName}), tekst ${pair.text}, akcent ${pair.accent} (${pair.accentName}).`;

    const headlineInstruction = customHeadline
      ? `Uzyj DOKLADNIE tego headline, nie zmieniaj tresci: "${customHeadline}"`
      : `Wyciagnij z posta krotki, konkretny headline (max 3 linie) - dokladnie o tym, o czym jest ten post, nie ogolnik o firmie.`;

    const photoInstruction = wantsPhoto ? `The LAST attached image is the real photo of the person featured in this post. This photo has higher priority than every other reference image attached below.

Treat this image as the primary visual anchor. Preserve the person's identity with the highest possible fidelity.

Do not change: facial structure, eyes, nose, mouth, hairstyle, facial hair, skin tone, age, expression, clothing, body proportions, pose, camera angle.

Do not reinterpret, beautify, stylize, redraw or replace the person. Do not generate a similar person. Use the supplied person exactly as the reference.

The person must be indistinguishable from the supplied photograph.

Build the entire composition around this photo. Modify only the surrounding graphic design: typography, colors, shapes, illustrations, background, layout.` : 'Ten post nie ma zdjecia - czysta kompozycja typograficzna z doodle/flubber zgodnie ze schematem, bez zdjecia i bez osoby.';

    const styleInstruction = styleNote ? `Uwaga stylistyczna od klienta, zastosuj ja: ${styleNote}` : '';

    const prompt = `${wantsPhoto ? 'PRIORYTET: dolaczone zdjecie osoby jest najwazniejsze - patrz instrukcja o zdjeciu nizej.\\n\\n' : ''}${schemaText}\\n\\n---\\n\\n${colorInstruction}\\n${headlineInstruction}\\n\\n${photoInstruction}\\n${styleInstruction}\\n\\nTresc posta:\\n${postText}\\n\\nPrzygotuj grafike zgodnie ze schematem, referencjami i powyzszymi instrukcjami.`;

    // Responses API + image_generation tool: model sam decyduje jak zbudowac obraz
    // na podstawie calego kontekstu (tekst + obrazy), zamiast statycznego images/edits.
    const imageContentParts = [];
    for (const f of references) {
      const buf = fs.readFileSync(path.join(EXAMPLES_DIR, f));
      imageContentParts.push({ type: 'input_image', image_url: `data:image/png;base64,${buf.toString('base64')}` });
    }
    if (wantsPhoto) {
      const b64in = userPhoto.includes(',') ? userPhoto.split(',')[1] : userPhoto;
      imageContentParts.push({ type: 'input_image', image_url: `data:image/jpeg;base64,${b64in}` });
    }

    const promptForApi = prompt + '\\n\\nWygeneruj teraz obraz tego posta przy uzyciu narzedzia image_generation. Nie odpowiadaj tekstem - wywolaj narzedzie i zwroc obraz.';

    const responsesReq = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-5',
        input: [{ role: 'user', content: [{ type: 'input_text', text: promptForApi }, ...imageContentParts] }],
        tools: [{ type: 'image_generation', size }],
        tool_choice: { type: 'image_generation' }
      })
    });
    const respData = await responsesReq.json();
    if (respData.error) throw new Error('OpenAI: ' + respData.error.message);
    const imgCall = (respData.output || []).find(item => item.type === 'image_generation_call');
    if (!imgCall || !imgCall.result) throw new Error('OpenAI nie zwrocil obrazu (brak image_generation_call w output)');
    const b64 = imgCall.result;

    res.json({
      image: 'data:image/png;base64,' + b64,
      prompt,
      referencesUsed: references,
      pair: { bg: pair.bg, bgName: pair.bgName, text: pair.text, accent: pair.accent },
      format: format || 'post-4-5',
      size,
      logo: null
    });
  } catch(e) {
    console.error('generate-image:', e.message);
    res.status(500).json({ error: e.message });
  }
});"""
assert content.count(ANCHOR_4) == 1, f"ANCHOR_4 count = {content.count(ANCHOR_4)}"

NEW_4 = """app.post('/api/design/generate-image', async (req, res) => {
  const { post, colorPairIdx, userPhoto, photoDescription, hasPhoto, customHeadline, styleNote, format, projectId } = req.body;
  if (!post) return res.status(400).json({ error: 'Brak posta' });
  const OPENAI_KEY = process.env.OPENAI_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'Brak OPENAI_KEY na serwerze' });

  const pairs = [
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#D0F200', bgName: 'neon', text: '#171717', accent: '#171717', accentName: 'dark' }
  ];
  const designAssets = await getProjectDesignAssets(projectId);
  const activePairs = (designAssets && designAssets.colorPairs && designAssets.colorPairs.length) ? designAssets.colorPairs : pairs;
  const pair = activePairs[colorPairIdx ?? 2] || activePairs[0];
  const wantsPhoto = hasPhoto !== false && !!userPhoto;

  const SIZE_MAP = { 'post-1-1': '1024x1024', 'post-4-5': '1024x1536', 'story': '1024x1536' };
  const size = SIZE_MAP[format] || '1024x1536';

  const DARK_REFS = ['dark-post-4_5-example-4.png', 'dark-post-square-example-1.png', 'dark-post-square-example-2.png', 'dark-post-square-example-3.png'];
  const LIGHT_REFS = ['light-post-4_5-example-8.png', 'light-post-square-example-5.png', 'light-post-square-example-6.png', 'light-post-square-example-7.png'];
  const references = pair.bgName === 'dark' ? DARK_REFS : LIGHT_REFS;
  const usingCustomRefs = !!(designAssets && designAssets.referenceImages && designAssets.referenceImages.length);

  try {
    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/schemat/schemat.md');
    const schemaText = (designAssets && designAssets.aiContextText)
      ? ('KONTEKST MARKI I STYL WIZUALNY' + (designAssets.brandName ? ' (' + designAssets.brandName + ')' : '') + ':\\n' + designAssets.aiContextText)
      : fs.readFileSync(schemaPath, 'utf8');
    const EXAMPLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/examples');

    const postText = `Tytul: ${post.title || ''}\\n${post.content || ''}`;

    const colorInstruction = `UZYJ DOKLADNIE tej pary kolorow, nie wybieraj innej z tabeli w schemacie: tlo ${pair.bg} (${pair.bgName}), tekst ${pair.text}, akcent ${pair.accent} (${pair.accentName}).`;

    const headlineInstruction = customHeadline
      ? `Uzyj DOKLADNIE tego headline, nie zmieniaj tresci: "${customHeadline}"`
      : `Wyciagnij z posta krotki, konkretny headline (max 3 linie) - dokladnie o tym, o czym jest ten post, nie ogolnik o firmie.`;

    const photoInstruction = wantsPhoto ? `The LAST attached image is the real photo of the person featured in this post. This photo has higher priority than every other reference image attached below.

Treat this image as the primary visual anchor. Preserve the person's identity with the highest possible fidelity.

Do not change: facial structure, eyes, nose, mouth, hairstyle, facial hair, skin tone, age, expression, clothing, body proportions, pose, camera angle.

Do not reinterpret, beautify, stylize, redraw or replace the person. Do not generate a similar person. Use the supplied person exactly as the reference.

The person must be indistinguishable from the supplied photograph.

Build the entire composition around this photo. Modify only the surrounding graphic design: typography, colors, shapes, illustrations, background, layout.` : 'Ten post nie ma zdjecia - czysta kompozycja typograficzna z doodle/flubber zgodnie ze schematem, bez zdjecia i bez osoby.';

    const styleInstruction = styleNote ? `Uwaga stylistyczna od klienta, zastosuj ja: ${styleNote}` : '';

    const logoInstruction = (designAssets && designAssets.logoDataUrl)
      ? 'Jeden z dolaczonych obrazow to dokladne logo marki - umiesc je czytelnie w rogu kompozycji (tam gdzie nie koliduje z tekstem), zachowaj dokladny ksztalt i kolory logo, nie przerysowuj go ani nie zmieniaj.'
      : '';

    const prompt = `${wantsPhoto ? 'PRIORYTET: dolaczone zdjecie osoby jest najwazniejsze - patrz instrukcja o zdjeciu nizej.\\n\\n' : ''}${schemaText}\\n\\n---\\n\\n${colorInstruction}\\n${headlineInstruction}\\n\\n${photoInstruction}\\n${styleInstruction}\\n${logoInstruction}\\n\\nTresc posta:\\n${postText}\\n\\nPrzygotuj grafike zgodnie ze schematem, referencjami i powyzszymi instrukcjami.`;

    // Responses API + image_generation tool: model sam decyduje jak zbudowac obraz
    // na podstawie calego kontekstu (tekst + obrazy), zamiast statycznego images/edits.
    const imageContentParts = [];
    if (usingCustomRefs) {
      designAssets.referenceImages.forEach(function(img){
        imageContentParts.push({ type: 'input_image', image_url: `data:${img.mime};base64,${img.base64}` });
      });
    } else {
      for (const f of references) {
        const buf = fs.readFileSync(path.join(EXAMPLES_DIR, f));
        imageContentParts.push({ type: 'input_image', image_url: `data:image/png;base64,${buf.toString('base64')}` });
      }
    }
    if (designAssets && designAssets.logoDataUrl) {
      imageContentParts.push({ type: 'input_image', image_url: designAssets.logoDataUrl });
    }
    if (wantsPhoto) {
      const b64in = userPhoto.includes(',') ? userPhoto.split(',')[1] : userPhoto;
      imageContentParts.push({ type: 'input_image', image_url: `data:image/jpeg;base64,${b64in}` });
    }

    const promptForApi = prompt + '\\n\\nWygeneruj teraz obraz tego posta przy uzyciu narzedzia image_generation. Nie odpowiadaj tekstem - wywolaj narzedzie i zwroc obraz.';

    const responsesReq = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-5',
        input: [{ role: 'user', content: [{ type: 'input_text', text: promptForApi }, ...imageContentParts] }],
        tools: [{ type: 'image_generation', size }],
        tool_choice: { type: 'image_generation' }
      })
    });
    const respData = await responsesReq.json();
    if (respData.error) throw new Error('OpenAI: ' + respData.error.message);
    const imgCall = (respData.output || []).find(item => item.type === 'image_generation_call');
    if (!imgCall || !imgCall.result) throw new Error('OpenAI nie zwrocil obrazu (brak image_generation_call w output)');
    const b64 = imgCall.result;

    res.json({
      image: 'data:image/png;base64,' + b64,
      prompt,
      referencesUsed: usingCustomRefs ? 'project-reference-designs' : references,
      pair: { bg: pair.bg, bgName: pair.bgName, text: pair.text, accent: pair.accent },
      format: format || 'post-4-5',
      size,
      logo: null
    });
  } catch(e) {
    console.error('generate-image:', e.message);
    res.status(500).json({ error: e.message });
  }
});"""

content = content.replace(ANCHOR_4, NEW_4, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: content/generate ma dynamiczna nazwe marki, generate-brief i generate-image czytaja logo/kolory/referencje z brand_assets projektu")
