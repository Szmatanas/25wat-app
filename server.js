import sharp from 'sharp';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors({
  origin: ['https://aisomeboost.vercel.app', 'https://aisomeboost.netlify.app', 'http://localhost:3000', 'http://localhost:5500'],
  methods: ['GET', 'POST'],
  credentials: false
}));
app.use(express.json({ limit: '15mb' }));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
const TAVILY_KEY = process.env.TAVILY_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';
const REMOVE_BG_KEY = process.env.REMOVEBG_API_KEY || '';
const COMPETITORS = [
  { name: 'Sellwise', query: 'Sellwise Szymon Negacz social media content 2026' },
  { name: 'Automation House', query: 'Automation House agencja AI Polska content 2026' },
  { name: 'W Praktyce AI', query: 'W Praktyce AI automatyzacja Polska content 2026' },
  { name: 'Agenci.ai', query: 'Agenci.ai Polska social media content 2026' },
];
async function tavilySearch(query) {
  const res = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: 'basic', max_results: 4 }) });
  if (!res.ok) throw new Error('Tavily ' + res.status);
  const data = await res.json();
  return data.results.map(r => '[' + r.title + ']\n' + r.content).join('\n\n---\n\n');
}
function safeJSON(raw) {
  try { return JSON.parse(raw.replace(/```json|```/g,'').replace(/[\u2013\u2014]/g,'-').replace(/[\u201c\u201d\u201e\u201f]/g,'"').replace(/[\u2018\u2019]/g,"'").trim()); }
  catch(e) { console.error('JSON err:',e.message); return {}; }
}
async function claude(system, context) {
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, system, messages: [{ role: 'user', content: 'Dane:\n' + context + '\n\nOdpowiedz TYLKO JSON po polsku. Bez em-dash, bez typograficznych cudzyslowow.' }] }) });
  if (!res.ok) { const e = await res.text(); throw new Error('Claude ' + res.status + ': ' + e); }
  const data = await res.json();
  return safeJSON(data.content.find(b => b.type === 'text')?.text || '{}');
}
async function removeBg(buf) {
  const form = new FormData();
  form.append('image_file', new Blob([buf]), 'photo.png');
  form.append('size', 'auto');
  const r = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': REMOVE_BG_KEY },
    body: form
  });
  if (!r.ok) { const e = await r.text(); throw new Error('remove.bg ' + r.status + ': ' + e); }
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

app.get('/', (req, res) => res.json({ status: 'ok' }));
app.post('/api/research', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Brak query' });
  try {
    const ctx = await tavilySearch(query + ' agencja AI Polska 2026');
    const sys = 'Jestes analitykiem w 25wat. Analizujesz: ' + query + '. Odpowiedz TYLKO JSON po polsku: {"summary":"max 2 zdania","threat_level":"low|medium|high","action":"max 1 zdanie"}';
    res.json({ analysis: await claude(sys, ctx) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/research/auto', async (req, res) => {
  try {
    const results = [];
    const comp = await Promise.allSettled(COMPETITORS.map(async (c) => {
      const ctx = await tavilySearch(c.query);
      const sys = 'Jestes analitykiem w polskiej agencji 25wat. Opisz krotko co konkurent "' + c.name + '" komunikuje teraz. Odpowiedz TYLKO JSON po polsku, max 10 slow na pole, bez em-dash: {"message":"co promuje/komunikuje teraz - max 10 slow","topic":"temat - max 4 slowa","opportunity":"szansa dla 25wat - max 8 slow","threat_level":"low|medium|high"}';
      return { name: c.name, analysis: await claude(sys, ctx) };
    }));
    comp.forEach(r => { if (r.status === 'fulfilled') results.push({ type: 'competitor', ...r.value }); });
    const tCtx = await tavilySearch('AI automatyzacja marketing B2B Polska czerwiec 2026');
    const tSys = 'Jestes analitykiem content w 25wat. Trendy AI i marketing B2B Polska teraz. Odpowiedz TYLKO JSON po polsku, bez em-dash: {"hot_topics":["temat 1 - max 8 slow","temat 2","temat 3","temat 4"],"content_angles":["kat 1 dla 25wat - max 8 slow","kat 2","kat 3"],"action":"napisz post o: max 10 slow"}';
    results.push({ type: 'trends', name: 'Trendy', analysis: await claude(tSys, tCtx) });
    res.json({ results });
  } catch(e) { console.error(e.message); res.status(500).json({ error: e.message }); }
});

app.post('/api/design/generate-photo', async (req, res) => {
  const { postTitle } = req.body;
  const hasDescription = !!(postTitle && postTitle.trim().length > 0);
  const prompt = hasDescription
    ? `Candid editorial portrait, photorealistic, natural soft daylight, clean neutral background suitable for knockout, calm confident mood, no filters, no stock-photo vibe, 4:5 aspect ratio. Follow this description closely for the person's appearance, clothing, setting and activity, do not default to generic office attire unless the description itself calls for it: ${postTitle}.`
    : `Candid editorial portrait of a confident person in their 30s with a Central European appearance (typical of Poland), wearing a strong-colored shirt (orange, green or grey), sitting at a laptop in a real modern office, making eye contact, natural soft daylight, clean neutral background suitable for knockout, calm professional mood, no filters, no stock-photo vibe, photorealistic, 4:5 aspect ratio.`;
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_KEY
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1536',
        quality: 'high'
      })
    });
    const data = await r.json();
    if (data.data?.[0]?.b64_json) {
      res.json({ url: 'data:image/png;base64,' + data.data[0].b64_json });
    } else {
      throw new Error(data.error?.message || 'Brak obrazu w odpowiedzi');
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Design generation: pary kolorow (na sztywno, z rules.md) ──
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

const ZONES = ['corner-br','corner-tr','side-right','side-left','center'];
const ALIGNS = ['top','center','bottom'];
const ACCENT_SHAPES = ['flubber-1','flubber-2','flubber-3','flubber-4','flubber-5','asterisk','chevrons'];
const PHOTO_SHAPES_FLUBBER = ['flubber','circle','rounded-square'];
const PHOTO_SHAPES_NOFLUBBER = ['circle','rounded-square'];

app.post('/api/design/generate-brief', async (req, res) => {
  const { post, colorPairIdx, hasPhoto, format, previousZone, previousAccentShape } = req.body;
  if (!post || !post.content) return res.status(400).json({ error: 'Brak posta' });
  const pairIdx = Number.isInteger(colorPairIdx) && COLOR_PAIRS[colorPairIdx] ? colorPairIdx : 2;
  const pair = COLOR_PAIRS[pairIdx];
  const fmt = FORMATS[format] ? format : 'post-4-5';
  const hasAccent = pair.accentType === 'flubber';
  const accentChoices = hasPhoto ? (hasAccent ? PHOTO_SHAPES_FLUBBER : PHOTO_SHAPES_NOFLUBBER) : (hasAccent ? ACCENT_SHAPES : ['none']);
  const variationNote = previousZone
    ? `\nWAZNE - REGENERACJA: poprzednio wybrales strefe "${previousZone}"${previousAccentShape ? ' i ksztalt "' + previousAccentShape + '"' : ''}. Tym razem wybierz WYRAZNIE INNA kombinacje - realna, widoczna zmiana.`
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
    const context = `Tytul posta: ${post.title || ''}\nTyp posta: ${post.type || ''}\nTresc posta: ${post.content}`;
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


const PHOTO_ARCHETYPES = {
  'text-left-photo-right': {
    prompt: 'LAYOUT: all text elements (headline, subheadline, stats, list items, CTA) must live entirely within a LEFT column occupying roughly the left 58% of the canvas width, full height, with generous margins. The RIGHT 42% of the canvas width, full height, must remain pure flat background color - absolutely no text, no letters, no shapes there. This right column is reserved for a photo cutout with an organic flubber blob accent shape behind it, to be composited afterward by another process. Treat the boundary between the two columns like the edge of the canvas.',
    region: (W, H) => ({ w: Math.round(W * 0.42), h: H - 160, left: W - Math.round(W * 0.42) - 40, top: 120 }),
    position: 'bottom'
  },
  'headline-top-photo-bottom': {
    prompt: 'LAYOUT: all text elements must fit ENTIRELY within the TOP 55% of the canvas height. The bottom 45% of the canvas, across its full width, must remain completely empty flat background color - absolutely no text, no letters, no doodles, no shapes may extend into this bottom band even partially. This bottom band is reserved for a real photograph to be composited afterward. Treat this bottom band exactly like the edge of the canvas.',
    region: (W, H) => ({ w: Math.round(W * 0.62), h: Math.round(H * 0.45) - 40, left: W - Math.round(W * 0.62) - 40, top: H - (Math.round(H * 0.45) - 40) - 40 }),
    position: 'bottom'
  },
  'photo-center-text-around': {
    prompt: 'LAYOUT: leave a rectangular area in the vertical middle of the canvas, roughly 50% of canvas width and 42% of canvas height, centered horizontally, completely empty flat background color - no text, no shapes there. Headline text goes above this area, supporting text or CTA goes below it. This central area is reserved for a photo cutout to be composited afterward.',
    region: (W, H) => ({ w: Math.round(W * 0.5), h: Math.round(H * 0.42), left: Math.round(W * 0.25), top: Math.round(H * 0.30) }),
    position: 'center'
  },
  'typography-hero-small-photo': {
    prompt: 'LAYOUT: huge bold typography dominates almost the entire canvas as the hero element. Leave one small square area, no larger than roughly 26% of canvas width, in the bottom-right corner completely empty flat background color - no text, no shapes there. This small area is reserved for a small circular or rounded-square photo cutout, a human accent, not the main focus.',
    region: (W, H) => { const s = Math.round(W * 0.26); return { w: s, h: s, left: W - s - 50, top: H - s - 50 }; },
    position: 'center'
  }
};
const ARCHETYPE_KEYS = Object.keys(PHOTO_ARCHETYPES);

app.post('/api/design/generate-image', async (req, res) => {
  const { post, colorPairIdx, userPhoto, photoDescription, hasPhoto, customHeadline, styleNote } = req.body;
  if (!post) return res.status(400).json({ error: 'Brak posta' });
  const OPENAI_KEY = process.env.OPENAI_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'Brak OPENAI_KEY na serwerze' });

  const pairs = [
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#D0F200', bgName: 'neon', text: '#171717', accent: '#171717', accentName: 'dark' }
  ];
  const pair = pairs[colorPairIdx ?? 2] || pairs[2];
  const wantsPhoto = hasPhoto !== false && !!userPhoto;
  const integratedPhoto = wantsPhoto && !!req.body.integratedPhoto;

  try {
    // 1. Claude tworzy creative brief - jeden ostry pomysl, nie opis firmy
    const briefSys = `Jestes Creative Directorem w agencji 25wat. Twoim zadaniem NIE jest podsumowac posta - masz wymyslic JEDEN mocny, konkretny insight wizualny, ktory da sie zaprojektowac.

Zly headline: "Jestesmy agencja kreatywna dla firm, ktore chca rosnac szybciej" (opis firmy, nic do zaprojektowania).
Dobry headline: "Procesy nie jadaja na urlop." (konkretny obraz, kontrast, cos do zilustrowania).

Zasady headline:
- max 3 linie, kazda linia krotka (2-5 slow)
- konkret / kontrast / obraz - nie ogolnik o marce czy branzy
- jedna fraza do wyroznienia kolorem akcentu

${wantsPhoto ? `Zdecyduj najpierw photoProminence: "hero" jesli osoba/jej historia jest centralna dla posta (zdjecie ma wtedy zajmowac duzy obszar kompozycji), "accent" jesli zdjecie to tylko dodatek do typografii/danych. Potem wybierz layout z listy, dopasowany do tresci, nastroju ORAZ do photoProminence: ${ARCHETYPE_KEYS.join(', ')}.` : ''}

Odpowiedz TYLKO JSON bez markdown:
{"coreIdea":"jednym zdaniem po polsku, o co naprawde chodzi w tym poscie","headline":"max 3 linie po polsku, konkretny obraz nie opis firmy","highlight":"fraza z headline do wyroznienia akcentem","visualMetaphor":"krotki opis po angielsku, jaki element graficzny/doodle ilustruje ta idee"${wantsPhoto ? `,"photoProminence":"hero|accent","layout":"jeden z: ${ARCHETYPE_KEYS.join('|')}"` : ''}}`;

    const briefReq = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: briefSys,
        messages: [{ role: 'user', content: `Post (typ: ${post.type || 'edukacyjny'}): ${post.title || ''}\n${post.content || ''}` + (customHeadline ? `\n\nUZYJ DOKLADNIE tego headline, nie zmieniaj tresci: "${customHeadline}"` : '') + (photoDescription ? `\n\nKontekst zdjecia: ${photoDescription}` : '') }]
      })
    });
    const briefData = await briefReq.json();
    const briefRaw = briefData.content?.find(b => b.type === 'text')?.text || '{}';
    const brief = safeJSON(briefRaw);
    if (!brief.headline) throw new Error('Claude nie zwrocil brief-u');

    const archetypeKey = wantsPhoto && PHOTO_ARCHETYPES[brief.layout] ? brief.layout : ARCHETYPE_KEYS[0];
    const archetype = PHOTO_ARCHETYPES[archetypeKey];

    // 2. Zbuduj finalny prompt do GPT Image na bazie brief-u (opisowy, jak art director, nie lista zakazow)
    const brandBrief = `Design a vertical 4:5 social media post for 25wat, a Polish AI/marketing agency, matching EXACTLY the visual brand style shown in the attached reference images (flat design, no gradients, no drop shadows, bold geometric sans-serif type, organic flubber blob accents, hand-drawn doodle accents).

Core idea to illustrate: ${brief.coreIdea}
Visual metaphor / accent: ${brief.visualMetaphor || 'a simple hand-drawn doodle near the key phrase'}

Hard rules:
- Solid flat background color: ${pair.bg} (${pair.bgName})
- Headline (exact text, do not change wording, keep the line breaks as natural short lines): "${brief.headline}"
- Highlight this exact phrase in ${pair.bgName === 'beige' ? '#7648F8 (ultraviolet)' : pair.bgName === 'dark' ? '#D0F200 (neon lime)' : pair.text + ' semibold, same color'}: "${brief.highlight || ''}"
- Headline text color otherwise: ${pair.text}
- Top-left corner: leave a small rectangular area (roughly 220px wide, 70px tall, starting right at the top-left edge) as pure flat background color, absolutely no shapes, no text, no logo there - reserved for a real logo to be overlaid afterward
- Do not draw any page numbers or slide numbers anywhere
- CRITICAL: any illustration, doodle, icon or decorative shape must NEVER touch, overlap, or visually cross the headline text or the highlighted phrase. Keep at least a clear gap between text and any decorative element, even outside the reserved photo zone.
- CRITICAL: the reserved photo zone described below must stay completely empty flat background color - no illustration, doodle, prop, sign, or any part of a decorative shape may extend, hang, or bleed into it, even partially. Treat its boundary exactly like the edge of the canvas.
${integratedPhoto ? '- The LAST attached reference image is a real photo of the person featured in this post. Preserve their face and identity with very high fidelity, exactly as shown - do not alter, stylize, or redraw their face or appearance. Design the entire composition (colors, flubber blob shape, doodle accents, layout, headline placement) around this exact photo as the hero of the piece, the way a magazine editorial integrates a real portrait into a designed page.' : (wantsPhoto ? archetype.prompt : '- No photo, no person - pure typographic composition with generous whitespace, the headline and visual metaphor doodle are the hero elements')}
${styleNote ? '- IMPORTANT client feedback on style, follow it closely: ' + styleNote : ''}
- Polish text spelled EXACTLY as given, correct diacritics`;

    const EXAMPLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/examples');
    let exampleFiles = [];
    try {
      const all = fs.readdirSync(EXAMPLES_DIR).filter(f => /\.(png|jpe?g)$/i.test(f));
      exampleFiles = all.filter(f => /4_5/i.test(f)).slice(0, 3);
      if (exampleFiles.length === 0) exampleFiles = all.slice(0, 3);
    } catch(e) { exampleFiles = []; }

    let b64;
    if (exampleFiles.length > 0) {
      const form = new FormData();
      form.append('model', 'gpt-image-1');
      const filesToSend = integratedPhoto ? exampleFiles.slice(0, 1) : exampleFiles;
      for (const f of filesToSend) {
        const buf = await sharp(fs.readFileSync(path.join(EXAMPLES_DIR, f))).resize(1024, 1536, { fit: 'inside' }).png().toBuffer();
        form.append('image[]', new Blob([buf], { type: 'image/png' }), f);
      }
      if (integratedPhoto) {
        const b64in = userPhoto.includes(',') ? userPhoto.split(',')[1] : userPhoto;
        const rawPhoto = Buffer.from(b64in, 'base64');
        const resizedPhoto = await sharp(rawPhoto).resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
        form.append('image[]', new Blob([resizedPhoto], { type: 'image/jpeg' }), 'real_photo.jpg');
      }
      form.append('prompt', brandBrief);
      form.append('size', '1024x1536');
      form.append('quality', 'high');
      form.append('input_fidelity', 'high');
      const imgReq = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: form
      });
      const imgData = await imgReq.json();
      if (imgData.error) throw new Error('OpenAI: ' + imgData.error.message);
      b64 = imgData.data?.[0]?.b64_json;
    } else {
      const imgReq = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: 'gpt-image-1', prompt: brandBrief, size: '1024x1536', quality: 'high', n: 1 })
      });
      const imgData = await imgReq.json();
      if (imgData.error) throw new Error('OpenAI: ' + imgData.error.message);
      b64 = imgData.data?.[0]?.b64_json;
    }
    if (!b64) throw new Error('OpenAI nie zwrocil obrazu');

    // 3. Wklej prawdziwe zdjecie usera lokalnie jako sylwetke (pomijamy gdy GPT juz narysowal prawdziwe zdjecie - integratedPhoto)
    if (wantsPhoto && !integratedPhoto) {
      const CANVAS_W = 1024, CANVAS_H = 1536;
      const region = archetype.region(CANVAS_W, CANVAS_H);

      const b64in = userPhoto.includes(',') ? userPhoto.split(',')[1] : userPhoto;
      const rawPhoto = Buffer.from(b64in, 'base64');

      let photoLayer;
      try {
        const cutoutBuf = await removeBg(rawPhoto);
        const trimmed = await sharp(cutoutBuf).trim().toBuffer();
        photoLayer = await sharp(trimmed)
          .resize(region.w, region.h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, position: archetype.position })
          .png()
          .toBuffer();
      } catch(e) {
        console.error('removeBg fallback:', e.message);
        photoLayer = await sharp(rawPhoto)
          .resize(region.w, region.h, { fit: 'cover' })
          .png()
          .toBuffer();
      }

      const bgBuf = Buffer.from(b64, 'base64');
      const composited = await sharp(bgBuf)
        .composite([{ input: photoLayer, top: region.top, left: region.left }])
        .png()
        .toBuffer();
      b64 = composited.toString('base64');
    }

    // 4. Nadpisz obszar logo wlasnym tlem w kolorze brandu, potem realne logo SVG
    const bgColorBuf = await sharp({ create: { width: 220, height: 70, channels: 4, background: pair.bg } }).png().toBuffer();
    const logoFile = pair.bgName === 'dark' ? 'primary-logo-25wat-light.svg' : 'primary-logo-25wat-dark.svg';
    const logoPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/logo', logoFile);
    const logoBuf = await sharp(fs.readFileSync(logoPath)).resize({ height: 44 }).png().toBuffer();
    const withLogo = await sharp(Buffer.from(b64, 'base64'))
      .composite([
        { input: bgColorBuf, top: 60, left: 60 },
        { input: logoBuf, top: 60, left: 60 }
      ])
      .png()
      .toBuffer();
    b64 = withLogo.toString('base64');

    res.json({
      image: 'data:image/png;base64,' + b64,
      prompt: brandBrief,
      brief,
      layout: integratedPhoto ? 'integrated-photo' : (wantsPhoto ? archetypeKey : null),
      pair: { bg: pair.bg, bgName: pair.bgName, text: pair.text, accent: pair.accent },
      logo: null
    });
  } catch(e) {
    console.error('generate-image:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.post('/api/design/account-action', async (req, res) => {
  const { message, post, colorPairIdx, hasPhoto, history } = req.body;
  const sys = `Jestes Account Managerem w agencji 25wat. Klient napisal chaotyczna, potocznie sformulowana uwage o designie posta, ktory wlasnie zostal wygenerowany. Twoim zadaniem jest zdecydowac JAKA AKCJE wykonac - nie realizuj jej samemu, tylko sklasyfikuj.

Dostepne akcje:
- "change_color": klient chce innej kolorystyki / palety / tla
- "restyle": klient chce zmiany stylu grafiki (np. mniej ilustracji, bardziej flat/minimalistyczne, inny nastroj, inna kompozycja, cos "dziwne")
- "change_photo": klient chce innego zdjecia albo inaczej pokazanej osoby
- "edit_copy": klient chce zmienic tekst posta, nie sam design
- "clarify": NIE jest jasne o co konkretnie chodzi - zadaj JEDNO precyzyjne pytanie dopytujace, NIE zgaduj

Dostepne pary kolorow (indeks: tlo / tekst / akcent) - UZYWAJ TYCH FAKTYCZNYCH KOLOROW zeby wybrac targetColorPairIdx, nie zgaduj numeru:
0: tlo ciemne #171717, tekst jasny #F2EDE3, akcent ultraviolet #7648F8
1: tlo ciemne #171717, tekst jasny #F2EDE3, akcent neon lime #D0F200
2: tlo jasne/bezowe #F2EDE3, tekst ciemny #171717, akcent neon lime #D0F200
3: tlo jasne/bezowe #F2EDE3, tekst ciemny #171717, akcent ultraviolet #7648F8
4: tlo neonowe #D0F200, tekst ciemny #171717, bez osobnego akcentu

Aktualne ustawienia: para kolorow numer ${typeof colorPairIdx === 'number' ? colorPairIdx : 'nieznana'} (0-4), post ${hasPhoto ? 'ZE zdjeciem' : 'BEZ zdjecia'}.

KRYTYCZNA ZASADA: jesli ponizej w historii rozmowy widac, ze juz wczesniej zadales pytanie typu clarify na ten sam temat i klient odpowiedzial (nawet ogolnikowo, nawet "po prostu wykonaj") - NIE WOLNO Ci zwrocic clarify drugi raz z rzedu na ten sam temat. Zamiast tego podejmij najlepsza mozliwa decyzje na podstawie calej rozmowy i wykonaj akcje. Maksymalnie JEDNO dopytanie na dany temat, potem dzialaj.

Odpowiedz TYLKO JSON: {"action":"change_color|restyle|change_photo|edit_copy|clarify","topic":"color|photo|style|copy|other - czego NAJBARDZIEJ dotyczy uwaga klienta, wypelnij zawsze niezaleznie od action","note":"krotka, precyzyjna instrukcja stylu po angielsku dla akcji restyle, w innym przypadku null","clarify":"pytanie po polsku dla akcji clarify, w innym przypadku null","targetColorPairIdx":"liczba 0-4 dla change_color dopasowana do FAKTYCZNYCH kolorow opisanych powyzej, w innym przypadku null"}`;

  try {
    const historyText = Array.isArray(history) && history.length
      ? '\n\nHistoria tej rozmowy o designie (od najstarszej):\n' + history.map(h => (h.role === 'user' ? 'Klient: ' : 'Account: ') + h.text).join('\n')
      : '';
    const context = `Post: ${post?.title || ''}\nTresc: ${post?.content || ''}${historyText}\n\nOstatnia uwaga klienta: ${message}`;
    const decision = await claude(sys, context);
    res.json(decision);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log('25wat API running on :' + PORT));

const BRAND_VOICE = `Jesteś copywriterem agencji 25wat (AI Driven Agency, Wrocław). Piszesz posty na Facebook po polsku.

WIEDZA O MARCE (CO komunikować):
- 25wat łączy performance marketing (Meta Ads, Google Ads) z automatyzacją AI procesów sprzedażowych
- Klient idealny: właściciel firmy B2B, 20-120 pracowników, wiek 36-45 lat, zna AI ale go to przerosło
- Główna przewaga: nie sprzedajemy narzędzi z półki - robimy custom automatyzacje dopasowane do infrastruktury klienta
- Bolączki klienta: ręczne powtarzalne czynności, chaos technologiczny, za długi cykl sprzedaży
- Argument ROI: handlowiec kosztuje ~162 000 zł/rok, automatyzacja = ułamek tego jednorazowo

ZASADY GŁOSU:
- Piszesz jak ktoś kto wie co robi i nie marnuje czasu czytelnika
- Bezpośrednio, konkretnie, zero korporacyjnego bełkotu
- Lekka ironia lub suchy humor są ok - bez patosu, bez coachingowej mowy
- Pierwsze zdanie MUSI zatrzymać scrollowanie - liczba, prowokacja lub obserwacja z życia
- Krótkie akapity: 3-6 na post
- Zawsze kończy się punchline lub naturalnym zamknięciem - nie osobną "moralą"
- Obserwacja z życia wygrywa z danymi z raportu
- Jezyk polski z polskimi znakami (ą, ę, ó, ś, ź, ż, ć, ń)

ZAKAZANE SŁOWA: "zagłębiać się", "krajobraz", "fascynujący", "niesamowity", "warto zaznaczyć"
ZAKAZANE OTWARCIA: "Jako agencja...", "Chcemy się podzielić...", "W dzisiejszych czasach..."
ZAKAZANA STRUKTURA: numerowane listy jako główna treść posta

ZAKAZY TREŚCI:
- NIE PISZ: "nasz system", "gwarantujemy", "nasz agent AI"
- NIGDY nie wymyślaj fikcyjnych firm, imion klientów ani konkretnych wyników których nie znasz
- Jeśli chcesz podać przykład - użyj: "jeden z naszych klientów z branży produkcyjnej" bez konkretów

FORMAT FB:
- Długość: 150-250 słów
- Emoji: max 2-3, tylko jako separatory sekcji, nie dekoracja
- Hashtagi: 3-5 na końcu, tylko w polu hashtags - NIE w treści posta
- CTA na końcu: pytanie do odbiorcy lub zaproszenie do kontaktu

UNIKAJ FORM TYPOWYCH DLA AI:
- Nie zaczynaj zdań od "Warto zauważyć", "Należy podkreślić", "Jest to kluczowe"
- Nie używaj konstrukcji "nie tylko... ale także", "zarówno... jak i"
- Nie pisz w stylu raportu ani prezentacji PowerPoint
- Unikaj pustych przymiotników: "kluczowy", "istotny", "efektywny", "skuteczny" bez uzasadnienia
- Pisz jak człowiek który mówi do drugiego człowieka, nie jak asystent AI

INTERPUNKCJA I JĘZYK:
- Używaj wyłącznie krótkiego myślnika (-) lub półpauzy (–), NIGDY długiej pauzy (—)
- Polskie znaki obowiązkowe: ą, ę, ó, ś, ź, ż, ć, ń, ł - zawsze
- Przecinki przed "który", "która", "które", "że", "bo", "ale", "jednak"
- Nie stawiaj przecinka przed "i" łączącym dwa elementy
- Zdania krótkie. Maksymalnie 2 przecinki w jednym zdaniu.
- Unikaj strony biernej ("zostało wdrożone" → "wdrożyliśmy")`;

app.post('/api/content/generate', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'Brak tematu' });
  try {
    const prompt = `Napisz 4 rozne propozycje postow na Facebook dla agencji 25wat na temat: "${topic}".

ZASADY FORMATU FB:
- Pierwsze zdanie to HOOK - ma zatrzymac scrollowanie, max 12 slow, zaczyna sie od liczby lub prowokacyjnego stwierdzenia
- Krotkie akapity: 1-2 zdania, oddzielone pustą linią
- Emoji jako separatory sekcji (nie dekoracja): uzyj 2-4 emoji w strategicznych miejscach
- Ostatnie zdanie to CTA lub pytanie do odbiorcy
- Dlugosc: 150-250 slow

Kazda propozycja inny kat narracyjny:
1. Edukacyjny - dane i liczby, lista punktow z emoji
2. Storytelling - historia klienta, konkretna sytuacja przed/po
3. Prowokacyjny - obalenie mitu lub kontrowersyjna teza
4. Angażujący - pytanie otwarte, zaproszenie do dyskusji

Wazne zasady:
- W polu content NIE umieszczaj hashtagow - ida tylko do pola hashtags
- W tresci uzyj punktorow jako • (kropka) nie jako myslniki
- Pierwsze zdanie bez imienia autora, bez "Czesc"

Odpowiedz TYLKO JSON bez markdown bez em-dash bez typograficznych cudzyslowow:
{"posts":[{"type":"edukacyjny","title":"max 5 slow","content":"tresc BEZ hashtagow z enterami jako nowe linie","hashtags":["tag1","tag2","tag3"]},{"type":"storytelling","title":"...","content":"...","hashtags":[...]},{"type":"prowokacyjny","title":"...","content":"...","hashtags":[...]},{"type":"angażujący","title":"...","content":"...","hashtags":[...]}]}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system: BRAND_VOICE, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) { const e = await r.text(); throw new Error('Claude ' + r.status + ': ' + e); }
    const data = await r.json();
    const raw = (data.content.find(b => b.type === 'text')?.text || '{}').replace(/```json|```/g,'').replace(/[\u2013\u2014]/g,'-').trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e) {
      const cleaned = raw.replace(/[\u2013\u2014]/g,'-').replace(/[\u201c\u201d\u201e\u201f]/g,'"').replace(/[\u2018\u2019]/g,"'").replace(/,(\s*[}\]])/g,'$1');
      parsed = JSON.parse(cleaned);
    }
    res.json(parsed);
  } catch(e) { console.error(e.message); res.status(500).json({ error: e.message }); }
});

app.post('/api/account/chat', async (req, res) => {
  const { message, systemPrompt } = req.body;
  if (!message) return res.status(400).json({ error: 'Brak wiadomości' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: systemPrompt || 'Jesteś Account Managerem w 25wat. Odpowiadasz po polsku, konkretnie.', messages: [{ role: 'user', content: message }] })
    });
    const data = await r.json();
    const text = data.content?.find(b => b.type === 'text')?.text || 'Błąd';
    res.json({ text });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
