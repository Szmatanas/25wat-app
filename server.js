import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const TAVILY_KEY    = process.env.TAVILY_KEY    || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';

const BRAND_CONTEXT = '25wat - AI Driven Agency (Wroclaw). Performance marketing + automatyzacja AI. Klient: wlasciciel B2B 20-120 pracownikow. Przewaga: laczenie leadow z automatyzacja sprzedazy.';

const COMPETITORS = [
  { name: 'Sellwise', query: 'Sellwise Szymon Negacz social media content 2026 AI sprzedaz' },
  { name: 'Automation House', query: 'Automation House Franciszek agencja AI content social media 2026' },
  { name: 'W Praktyce AI', query: 'W Praktyce AI automatyzacja content Facebook LinkedIn 2026' },
  { name: 'Agenci.ai', query: 'Agenci.ai social media content post automatyzacja 2026' },
];

async function tavilySearch(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: 'basic', max_results: 5 })
  });
  if (!res.ok) throw new Error('Tavily ' + res.status);
  const data = await res.json();
  return data.results.map(r => '[' + r.title + ']\n' + r.content).join('\n\n---\n\n');
}

async function claudeAnalyze(system, context) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system, messages: [{ role: 'user', content: 'Dane:\n' + context + '\n\nZwroc TYLKO JSON.' }] })
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
    const system = 'Jestes strategiem w 25wat. Analizujesz: ' + query + '. Odpowiedz TYLKO JSON: {"summary":"2 zdania","strengths":["max 3"],"weaknesses":["max 3"],"opportunities":["max 2"],"threat_level":"low|medium|high","action":"1 konkretna akcja"}';
    const analysis = await claudeAnalyze(system, context);
    res.json({ analysis, sources: 5 });
  } catch (e) { console.error(e.message); res.status(500).json({ error: e.message }); }
});

app.post('/api/research/auto', async (req, res) => {
  try {
    const results = [];

    const compResults = await Promise.allSettled(COMPETITORS.map(async (comp) => {
      const context = await tavilySearch(comp.query);
      const system = `Jestes strategiem w agencji 25wat (AI Driven Agency, Wroclaw).
Kontekst 25wat: ${BRAND_CONTEXT}
Analizujesz konkurenta: ${comp.name}

Na podstawie znalezionych danych odpowiedz na pytanie: CO TEN KONKURENT KOMUNIKUJE TERAZ?
Opisz jego glowny przekaz, temat lub akcje ktora prowadzi w social mediach.
Potem napisz szanse dla 25wat.

Odpowiedz TYLKO JSON (bez markdown):
{
  "message": "1 zdanie — co komunikuje/promuje teraz (konkretnie, bez ogolnikow)",
  "topic": "temat przewodni (2-4 slowa)",
  "opportunity": "1 zdanie — jak 25wat moze na tym skorzystac",
  "threat_level": "low|medium|high"
}`;
      const analysis = await claudeAnalyze(system, context);
      return { name: comp.name, analysis };
    }));

    compResults.forEach(r => {
      if (r.status === 'fulfilled') results.push({ type: 'competitor', ...r.value });
      else console.error('Comp err:', r.reason?.message);
    });

    const trendCtx = await tavilySearch('AI automatyzacja marketing B2B Polska czerwiec 2026 trendy');
    const trendSys = `Jestes strategiem content w 25wat (AI Driven Agency, Wroclaw).
Kontekst: ${BRAND_CONTEXT}
Analizujesz trendy w AI i marketingu B2B w Polsce — czerwiec 2026.

Odpowiedz TYLKO JSON (bez markdown):
{
  "hot_topics": ["temat 1 — 1 zdanie", "temat 2 — 1 zdanie", "temat 3 — 1 zdanie", "temat 4 — 1 zdanie"],
  "content_angles": ["kat do posta dla 25wat — 1 zdanie", "kat 2 — 1 zdanie", "kat 3 — 1 zdanie"],
  "action": "Napisz teraz: [tytul posta] — [1 zdanie o czym]"
}`;
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
