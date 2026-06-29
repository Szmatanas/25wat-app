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
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, system, messages: [{ role: 'user', content: 'Dane:\n' + context + '\n\nOdpowiedz TYLKO JSON po polsku. Bez em-dash, bez typograficznych cudzyslowow.' }] }) });
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

const BRAND_VOICE = `Kontekst marki 25wat AI Driven Agency:
- Ton: powazny, wyważony, pionierski. Piszemy jak ktos kto wie co robi i nie marnuje czasu klienta.
- Klient: wlasciciel firmy B2B 20-120 pracownikow, wiek 36-45, zna AI ale go to przerosl.
- NIE PISZ: "nasz system", "gwarantujemy", "jakos lidow", "nasz agent AI".
- NIGDY nie wymyslaj fikcyjnych case studies, nazw firm, imion klientow ani konkretnych wynikow ktorych nie znasz. Zamiast tego uzyj ogolnych sformulowan: "jedna z firm z ktorymi pracujemy", "klient z branzy produkcyjnej", lub nie podawaj przykladow wcale.
- ZAWSZE: CTA na koncu, konkretna liczba lub fakt (tylko jesli jest powszechnie znany), hashtagi branżowe.
- Format FB: 3-5 akapitow, emoji max 2-3, hashtagi na koncu 3-5.
- Jezyk: polski, konkretny, bez korpomowy.`;

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
    res.json(JSON.parse(raw));
  } catch(e) { console.error(e.message); res.status(500).json({ error: e.message }); }
});
