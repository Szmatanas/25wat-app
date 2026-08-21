import io

PATH = "server.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_COMP_FN = """async function getProjectCompetitors(projectId) {
  if (!projectId) return COMPETITORS;
  try {
    const result = await pool.query(
      "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'competitors' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const text = result.rows[0] && result.rows[0].text_content;
    if (!text) return COMPETITORS;
    const lines = text.split('\\n').map(l => l.replace(/^[-*]\\s*/, '').trim()).filter(l => l.length > 0);
    if (!lines.length) return COMPETITORS;
    return lines.map(name => ({ name, query: name + ' social media content 2026' }));
  } catch (e) {
    console.error('getProjectCompetitors:', e.message);
    return COMPETITORS;
  }
}"""

assert content.count(ANCHOR_COMP_FN) == 1, f"ANCHOR_COMP_FN count = {content.count(ANCHOR_COMP_FN)}"

NEW_COMP_FN = """const LEGACY_25WAT_PROJECT_ID = 1;

async function getProjectCompetitors(projectId) {
  try {
    if (projectId) {
      const result = await pool.query(
        "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'competitors' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        [projectId]
      );
      const text = result.rows[0] && result.rows[0].text_content;
      if (text) {
        return text.split('\\n').map(l => l.replace(/^[-*]\\s*/, '').trim()).filter(l => l.length > 0).map(name => ({ name, query: name + ' social media content 2026' }));
      }
    }
  } catch (e) {
    console.error('getProjectCompetitors:', e.message);
  }
  return (Number(projectId) === LEGACY_25WAT_PROJECT_ID) ? COMPETITORS : [];
}"""

content = content.replace(ANCHOR_COMP_FN, NEW_COMP_FN, 1)

ANCHOR_TRENDS_FN = """async function getProjectTrendsFocus(projectId) {
  const DEFAULT_FOCUS = 'AI automatyzacja marketing B2B Polska';
  if (!projectId) return DEFAULT_FOCUS;
  try {
    const result = await pool.query(
      "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'trends_focus' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const text = result.rows[0] && result.rows[0].text_content;
    return (text && text.trim()) ? text.trim() : DEFAULT_FOCUS;
  } catch (e) {
    console.error('getProjectTrendsFocus:', e.message);
    return DEFAULT_FOCUS;
  }
}"""

assert content.count(ANCHOR_TRENDS_FN) == 1, f"ANCHOR_TRENDS_FN count = {content.count(ANCHOR_TRENDS_FN)}"

NEW_TRENDS_FN = """async function getProjectTrendsFocus(projectId) {
  const DEFAULT_FOCUS = 'AI automatyzacja marketing B2B Polska';
  try {
    if (projectId) {
      const result = await pool.query(
        "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'trends_focus' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        [projectId]
      );
      const text = result.rows[0] && result.rows[0].text_content;
      if (text && text.trim()) return text.trim();
    }
  } catch (e) {
    console.error('getProjectTrendsFocus:', e.message);
  }
  return (Number(projectId) === LEGACY_25WAT_PROJECT_ID) ? DEFAULT_FOCUS : null;
}"""

content = content.replace(ANCHOR_TRENDS_FN, NEW_TRENDS_FN, 1)

ANCHOR_HANDLER = """    const activeCompetitors = await getProjectCompetitors(projectId);
    const comp = await Promise.allSettled(activeCompetitors.map(async (c) => {
      const { text: ctx, sources } = await tavilySearchFull(c.query, COMPETITOR_DOMAINS);
      if (!ctx || ctx.trim().length < 30) {
        return { name: c.name, analysis: { message: null, topic: null, opportunity: null, threat_level: 'low', noData: true }, sources: [], checkedAt: dateLabel };
      }
      const sys = 'Jestes analitykiem w polskiej agencji 25wat. Opisz krotko co konkurent "' + c.name + '" komunikuje teraz. Odpowiedz TYLKO JSON po polsku, max 10 slow na pole, bez em-dash: {"message":"co promuje/komunikuje teraz - max 10 slow","topic":"temat - max 4 slowa","opportunity":"szansa dla 25wat - max 8 slow","threat_level":"low|medium|high"}';
      return { name: c.name, analysis: await claude(sys, ctx), sources, checkedAt: dateLabel };
    }));
    comp.forEach(r => { if (r.status === 'fulfilled') results.push({ type: 'competitor', ...r.value }); });
    const activeTrendsFocus = await getProjectTrendsFocus(projectId);
    const { text: tCtx, sources: trendSources } = await tavilySearchFull(activeTrendsFocus + ' ' + dateLabel, TREND_PORTALS);
    const tSys = 'Jestes analitykiem content w 25wat. Trendy: ' + activeTrendsFocus + ' teraz. Odpowiedz TYLKO JSON po polsku, bez em-dash: {"hot_topics":["temat 1 - max 8 slow","temat 2","temat 3","temat 4"],"content_angles":["kat 1 dla 25wat - max 8 slow","kat 2","kat 3"],"action":"napisz post o: max 10 slow"}';
    results.push({ type: 'trends', name: 'Trendy', analysis: await claude(tSys, tCtx), sources: trendSources, checkedAt: dateLabel });
    res.json({ results });"""

assert content.count(ANCHOR_HANDLER) == 1, f"ANCHOR_HANDLER count = {content.count(ANCHOR_HANDLER)}"

NEW_HANDLER = """    const activeCompetitors = await getProjectCompetitors(projectId);
    if (!activeCompetitors.length) {
      results.push({ type: 'competitors_missing', checkedAt: dateLabel });
    } else {
      const comp = await Promise.allSettled(activeCompetitors.map(async (c) => {
        const { text: ctx, sources } = await tavilySearchFull(c.query, COMPETITOR_DOMAINS);
        if (!ctx || ctx.trim().length < 30) {
          return { name: c.name, analysis: { message: null, topic: null, opportunity: null, threat_level: 'low', noData: true }, sources: [], checkedAt: dateLabel };
        }
        const sys = 'Jestes analitykiem opisujacym konkurencje. Opisz krotko co konkurent "' + c.name + '" komunikuje teraz. Odpowiedz TYLKO JSON po polsku, max 10 slow na pole, bez em-dash: {"message":"co promuje/komunikuje teraz - max 10 slow","topic":"temat - max 4 slowa","opportunity":"szansa dla klienta - max 8 slow","threat_level":"low|medium|high"}';
        return { name: c.name, analysis: await claude(sys, ctx), sources, checkedAt: dateLabel };
      }));
      comp.forEach(r => { if (r.status === 'fulfilled') results.push({ type: 'competitor', ...r.value }); });
    }
    const activeTrendsFocus = await getProjectTrendsFocus(projectId);
    if (!activeTrendsFocus) {
      results.push({ type: 'trends_missing', checkedAt: dateLabel });
    } else {
      const { text: tCtx, sources: trendSources } = await tavilySearchFull(activeTrendsFocus + ' ' + dateLabel, TREND_PORTALS);
      const tSys = 'Jestes analitykiem content. Trendy: ' + activeTrendsFocus + ' teraz. Odpowiedz TYLKO JSON po polsku, bez em-dash: {"hot_topics":["temat 1 - max 8 slow","temat 2","temat 3","temat 4"],"content_angles":["kat 1 - max 8 slow","kat 2","kat 3"],"action":"napisz post o: max 10 slow"}';
      results.push({ type: 'trends', name: 'Trendy', analysis: await claude(tSys, tCtx), sources: trendSources, checkedAt: dateLabel });
    }
    res.json({ results });"""

content = content.replace(ANCHOR_HANDLER, NEW_HANDLER, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: 25wat (id=1) zostaje jak jest, wszystkie inne projekty startuja od zera i dostaja competitors_missing/trends_missing")
