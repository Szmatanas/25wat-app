import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """    return parts.length ? parts.join('\\n\\n') : null;
  } catch (e) {
    console.error('getProjectBrandContext:', e.message);
    return null;
  }
}

app.post('/api/content/generate', async (req, res) => {"""
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"

NEW = """    return parts.length ? parts.join('\\n\\n') : null;
  } catch (e) {
    console.error('getProjectBrandContext:', e.message);
    return null;
  }
}

app.post('/api/projects/:projectId/assets/generate-ai-context', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const textResult = await pool.query(
      "SELECT category, text_content FROM brand_assets WHERE project_id = $1 AND category IN ('brand_context','tone_of_voice') AND text_content IS NOT NULL ORDER BY created_at DESC",
      [req.projectId]
    );
    const byCat = {};
    textResult.rows.forEach(r => { if (!byCat[r.category]) byCat[r.category] = r.text_content; });
    if (!byCat.brand_context && !byCat.tone_of_voice) {
      return res.status(400).json({ error: 'Wgraj najpierw Brand Strategy lub Tone of Voice (tekst albo plik) - AI potrzebuje materialu zrodlowego.' });
    }

    const imgResult = await pool.query(
      "SELECT file_data, mime_type FROM brand_assets WHERE project_id = $1 AND category = 'reference_designs' AND file_data IS NOT NULL ORDER BY created_at DESC LIMIT 4",
      [req.projectId]
    );

    const sys = 'Jestes Strategiem Brandowym. Na podstawie materialow zrodlowych klienta (brand strategy, tone of voice, przykladowe kreacje graficzne) zbuduj DOKUMENT "AI CONTEXT" ktory bedzie zasilal generowanie tresci i grafik dla tej marki.\\n\\nStruktura dokumentu (trzymaj sie dokladnie tych sekcji, po polsku):\\n\\n## PALETA KOLOROW\\n- Jesli widac kolory na przykladowych grafikach - wypisz je opisowo. Jesli brak grafik - napisz "brak danych - pomin, dopisac pozniej".\\n\\n## TYPOGRAFIA\\n- Charakter fontu widoczny na grafikach (szeryfowy/bezszeryfowy, grubosc, styl naglowkow). Jesli brak danych - napisz "brak danych - pomin".\\n\\n## KOMPOZYCJA I HIERARCHIA\\n- Wzorzec ukladu widoczny na przykladowych kreacjach (logo, tekst, ilosc bialej przestrzeni). Jesli brak - "brak danych - pomin".\\n\\n## STYL ZDJEC\\n- Jesli na przykladach sa zdjecia - opisz styl. Jesli brak - "brak danych - pomin".\\n\\n## CZERWONE LINIE\\n- Czego marka na pewno unika, wywnioskowane z brand strategy/tone of voice.\\n\\n## VOICE & TON (podsumowanie)\\n- 3-4 zdania kluczowych cech tonu marki, wyciagniete z materialow.\\n\\nNie zmyslaj kolorow, fontow ani faktow ktorych nie widac w materiale. Gdy czegos brakuje - napisz wprost "brak danych - pomin, dopisac pozniej" zamiast wymyslac.';

    const contentBlocks = [];
    if (byCat.brand_context) contentBlocks.push({ type: 'text', text: 'BRAND STRATEGY:\\n' + byCat.brand_context });
    if (byCat.tone_of_voice) contentBlocks.push({ type: 'text', text: 'TONE OF VOICE:\\n' + byCat.tone_of_voice });
    imgResult.rows.forEach(row => {
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: row.mime_type || 'image/png', data: row.file_data.toString('base64') }
      });
    });
    if (!imgResult.rows.length) contentBlocks.push({ type: 'text', text: '(Brak przykladowych kreacji - pomin sekcje PALETA/TYPOGRAFIA/KOMPOZYCJA/STYL ZDJEC jako "brak danych")' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys, messages: [{ role: 'user', content: contentBlocks }] })
    });
    const data = await r.json();
    const generated = (data.content && data.content[0] && data.content[0].text) || '';
    if (!generated) return res.status(500).json({ error: 'Brak odpowiedzi od AI' });
    res.json({ generated });
  } catch (e) {
    console.error('generate-ai-context:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/content/generate', async (req, res) => {"""

content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: dodano endpoint POST /api/projects/:projectId/assets/generate-ai-context")
