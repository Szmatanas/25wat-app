import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const TAVILY_KEY    = process.env.TAVILY_KEY    || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';

const BRAND_CONTEXT = `25wat - AI Driven Agency (Wroclaw). Lacz performance marketing (Meta/Google Ads) z automatyzacja AI. Klient: wlasciciel B2B 20-120 pracownikow. Konkurenci: Sellwise, Automation House, W Praktyce AI, Agenci.ai. Przewaga vs Sellwise: performance marketing. Przewaga vs reszta: custom wdrozenia, zespol marketingowy.`;

const COMPETITORS = ['Sellwise', 'Automation House agencja AI', 'W Praktyce AI automatyzacja', 'Agenci.ai'];

async function tavilySearch(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: 'advanced', max_results: 5 }),
  });
  if (!res.ok) throw new Error('Tavily ' + res.status);
  const data = await res.json();
  return data.results.map(r => '[' + r.title + ']\n' + r.content).join('\n\n---\n\n');
}

async function claudeAnalyze(system, context) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system, messages: [{ role: 'user', content: 'Wyniki:\n' + context + '\n\nZwroc TYLKO JSON.' }] }),
  });
  if (!res.ok) { const e = await res.text(); throw new Error('Claude ' + res.status + ': ' + e); }
  const data = await res.json();
  const raw = (data.content.find(b => b.type === 'text')?.text || '{}').replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

app.get('/', (req, res) => res.json({ status: 'ok' }));

app.post('/api/research', async (req, res) => {
  const { query, category } = req.body;
  if (!query || !category) return res.status(400).json({ error: 'Brak danych' });
  try {
    const context = await tavilySearch(query + ' agencja AI automatyzacja Polska 2026');
    const system = 'Jestes strategiem w 25wat. Kontekst: ' + BRAND_CONTEXT + ' Analizujesz: ' + query + '. Odpowiedz TYLKO JSON: {"summary":"2 zdania","strengths":["max 3"],"weaknesses":["max 3"],"opportunities":["max 2"],"threat_level":"low|medium|high","action":"1 konkretna akcja dla 25wat"}';
    const analysis = await claudeAnalyze(system, context);
    res.json({ analysis, sources: 5 });
  } catch (e) { console.error(e.message); res.status(500).json({ error: e.message }); }
});

app.post('/api/research/auto', async (req, res) => {
  try {
    const results = [];
    const compResults = await Promise.allSettled(COMPETITORS.map(async (name) => {
      const context = await tavilySearch(name + ' agencja AI Polska 2026');
      const system = 'Jestes strategiem w 25wat. Kontekst: ' + BRAND_CONTEXT + ' Analizujesz konkurenta: ' + name + '. Odpowiedz TYLKO JSON: {"summary":"2 zdania","strengths":["max 3"],"weaknesses":["max 3"],"opportunities":["max 2"],"threat_level":"low|medium|high","action":"1 konkretna akcja dla 25wat"}';
      const analysis = await claudeAnalyze(system, context);
      return { name: name.split(' ')[0], analysis };
    }));
    compResults.forEach(r => { if (r.status === 'fulfilled') results.push({ type: 'competitor', ...r.value }); });
    const trendCtx = await tavilySearch('AI automatyzacja marketing B2B Polska trendy 2026');
    const trendSys = 'Jestes strategiem content w 25wat. Kontekst: ' + BRAND_CONTEXT + ' Analizujesz trendy. Odpowiedz TYLKO JSON: {"summary":"2 zdania","hot_topics":["max 4"],"content_angles":["max 3 katy do postow dla 25wat"],"timing":"kiedy publikowac","action":"1 konkretny post TERAZ"}';
    const trendAnalysis = await claudeAnalyze(trendSys, trendCtx);
    results.push({ type: 'trends', name: 'Trendy AI Polska', analysis: trendAnalysis });
    res.json({ results });
  } catch (e) { console.error(e.message); res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('25wat API running on :' + PORT));
