import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const TAVILY_KEY    = process.env.TAVILY_KEY    || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';

const BRAND_CONTEXT = '25wat - AI Driven Agency (Wroclaw). Performance marketing + automatyzacja AI. Klient: wlasciciel B2B 20-120 pracownikow.';

const COMPETITORS = [
  { name: 'Sellwise', query: 'Sellwise Szymon Negacz social media 2026' },
  { name: 'Automation House', query: 'Automation House agencja AI content 2026' },
  { name: 'W Praktyce AI', query: 'W Praktyce AI automatyzacja content 2026' },
  { name: 'Agenci.ai', query: 'Agenci.ai social media content 2026' },
];

async function tavilySearch(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: 'basic', max_results: 4 })
  });
  if (!res.ok) throw new Error('Tavily ' + res.status);
  const data = await res.json();
  return data.results.map(r => '[' + r.title + ']\n' + r.content).join('\n\n---\n\n');
}

function safeParseJSON(raw) {
  try {
    const cleaned = raw
      .replace(/```json/g, '').replace(/```/g, '')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .trim();
    return JSON.parse(cleaned);
  } catch(e) {
    console.error('JSON parse error:', e.message, 'raw:', raw.substring(0, 200));
    return { error: 'parse_error', message: raw.substring(0, 100) };
  }
}

async function claudeAnalyze(system, context) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system, messages: [{ role: 'user', content: 'Dane:\n' + context + '\n\nZwroc TYLKO JSON. Uzyj tylko zwyklych znakow ASCII w JSON - nie uzywaj myslnikow em-dash ani cudzyslowow typograficznych.' }] })
  });
  if (!res.ok) { const e = await res.text(); throw new Error('Claude ' + res.status + ': ' + e); }
  const data = await res.json();
  const raw = data.content.find(b => b.type === 'text')?.text || '{}';
  return safeParseJSON(raw);
}

app.get('/', (req, res) => res.json({ status: 'ok' }));

app.post('/api/research', async (req, res) => {
  const { query, category } = req.body;
  if (!query || !category) return res.status(400).json({ error: 'Brak danych' });
  try {
    const context = await tavilySearch(query + ' agencja AI Polska 2026');
    const system = 'Jestes strategiem w 25wat. Analizujesz: ' + query + '. Odpowiedz TYLKO JSON z prostymi cudzystowami i bez em-dash: {"summary":"2 zdania","strengths":["max 3"],"weaknesses":["max 3"],"opportunities":["max 2"],"threat_level":"low|medium|high","action":"1 akcja"}';
    const analysis = await claudeAnalyze(system, context);
    res.json({ analysis, sources: 4 });
  } catch (e) { console.error(e.message); res.status(500).json({ error: e.message }); }
});

app.post('/api/research/auto', async (req, res) => {
  try {
    const results = [];

    const compResults = await Promise.allSettled(COMPETITORS.map(async (comp) => {
      const context = await tavilySearch(comp.query);
      const system = 'Jestes strategiem w 25wat. Analizujesz konkurenta: ' + comp.name + '. Co ten konkurent komunikuje teraz w social mediach? Odpowiedz TYLKO JSON z prostymi cudzystowami, bez em-dash (uzyj zwyklego myslnika -): {"message":"1 zdanie co komunikuje/promuje teraz","topic":"temat 2-4 slowa","opportunity":"1 zdanie jak 25wat moze skorzystac","threat_level":"low|medium|high"}';
      const analysis = await claudeAnalyze(system, context);
      return { name: comp.name, analysis };
    }));

    compResults.forEach(r => {
      if (r.status === 'fulfilled') results.push({ type: 'competitor', ...r.value });
      else console.error('Comp err:', r.reason?.message);
    });

    const trendCtx = await tavilySearch('AI automatyzacja marketing B2B Polska czerwiec 2026');
    const trendSys = 'Jestes strategiem content w 25wat. Analizujesz trendy AI i marketing B2B Polska. Odpowiedz TYLKO JSON z prostymi cudzystowami, bez em-dash: {"hot_topics":["temat 1","temat 2","temat 3","temat 4"],"content_angles":["kat 1 dla 25wat","kat 2","kat 3"],"action":"1 konkretny post dla 25wat TERAZ"}';
    const trendAnalysis = await claudeAnalyze(trendSys, trendCtx);
    results.push({ type: 'trends', name: 'Trendy', analysis: trendAnalysis });

    res.json({ results });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('25wat API running on :' + PORT));
