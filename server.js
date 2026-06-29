import express from 'express';
import cors from 'cors';
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
const TAVILY_KEY = process.env.TAVILY_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';
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
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, system, messages: [{ role: 'user', content: 'Dane:\n' + context + '\n\nOdpowiedz TYLKO JSON po polsku. Bez em-dash, bez typograficznych cudzyslowow.' }] }) });
  if (!res.ok) { const e = await res.text(); throw new Error('Claude ' + res.status + ': ' + e); }
  const data = await res.json();
  return safeJSON(data.content.find(b => b.type === 'text')?.text || '{}');
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
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('25wat API running on :' + PORT));
