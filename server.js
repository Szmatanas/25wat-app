import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ── Klucze API (zmień na swoje lub ustaw jako zmienne środowiskowe) ──
const TAVILY_KEY  = process.env.TAVILY_KEY  || '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';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';  // ustaw w Railway jako env var

// ── Health check ──
app.get('/', (req, res) => res.json({ status: 'ok', service: '25wat Research API' }));

// ── POST /api/research ──
// body: { query: string, category: 'competitor'|'trends'|'brand' }
app.post('/api/research', async (req, res) => {
  const { query, category } = req.body;
  if (!query || !category) return res.status(400).json({ error: 'Brak query lub category' });

  try {
    // 1. Tavily search
    const suffixMap = {
      competitor: 'firma social media marketing opinie',
      trends:     'trend 2025 2026 Polska rynek',
      brand:      'rynek Polska agencja konkurencja',
    };

    const tvRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: `${query} ${suffixMap[category]}`,
        search_depth: 'advanced',
        max_results: 8,
        include_answer: true,
      }),
    });
    if (!tvRes.ok) throw new Error(`Tavily error: ${tvRes.status}`);
    const tvData = await tvRes.json();
    const context = tvData.results.map(r => `[${r.title}]\n${r.content}`).join('\n\n---\n\n');

    // 2. Claude analysis
    const promptMap = {
      competitor: `Jesteś Senior Strategiem w agencji 25wat (Wrocław). Analizujesz konkurenta. Odpowiedz TYLKO JSON bez markdown:
{"summary":"2-3 zdania PL","strengths":["..."],"weaknesses":["..."],"opportunities":["..."],"content_strategy":"1 zdanie","threat_level":"low|medium|high","action":"1 konkretna rekomendacja dla 25wat"}`,
      trends: `Jesteś Senior Content Strategiem w 25wat. Analizujesz trendy. Odpowiedz TYLKO JSON bez markdown:
{"summary":"2-3 zdania PL","hot_topics":["..."],"content_angles":["..."],"keywords":["..."],"timing":"kiedy publikować","action":"1 konkretny post do zrobienia TERAZ"}`,
      brand: `Jesteś Senior Brand Analitykiem w 25wat. Analizujesz branżę. Odpowiedz TYLKO JSON bez markdown:
{"summary":"2-3 zdania PL","key_players":["..."],"content_gaps":["..."],"positioning":"jak 25wat powinno się pozycjonować","audience_insights":"1-2 zdania","action":"1 konkretna rekomendacja"}`,
    };

    const clRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: promptMap[category],
        messages: [{
          role: 'user',
          content: `Zapytanie: "${query}"\n\nWyniki wyszukiwania:\n${context}\n\nZwróć TYLKO JSON.`,
        }],
      }),
    });
    if (!clRes.ok) clRes.text().then(b=>{console.error("Claude body:",b);throw new Error("Claude "+clRes.status+" "+b)});
    const clData = await clRes.json();
    const raw = (clData.content.find(b => b.type === 'text')?.text || '{}')
      .replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(raw);

    res.json({
      analysis,
      sources: tvData.results.length,
      results: tvData.results.map(r => ({ title: r.title, url: r.url })),
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`25wat API running on :${PORT}`));
