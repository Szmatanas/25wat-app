import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """    const result = await pool.query(
      "SELECT category, text_content FROM brand_assets WHERE project_id = $1 AND category IN ('brand_context','tone_of_voice','ai_context') AND text_content IS NOT NULL ORDER BY created_at DESC",
      [projectId]
    );
    if (!result.rows.length) return null;
    const byCat = {};
    result.rows.forEach(r => { if (!byCat[r.category]) byCat[r.category] = r.text_content; });
    const parts = [];
    if (byCat.brand_context) parts.push('BRAND STRATEGY:\\n' + byCat.brand_context);
    if (byCat.tone_of_voice) parts.push('TONE OF VOICE:\\n' + byCat.tone_of_voice);
    if (byCat.ai_context) parts.push('AI CONTEXT (design, konkurencja):\\n' + byCat.ai_context);
    return parts.length ? parts.join('\\n\\n') : null;"""
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"

NEW = """    const result = await pool.query(
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
    return parts.length ? parts.join('\\n\\n') : null;"""

content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: getProjectBrandContext dolacza Twoje wytyczne (ai_context_rules) jako nadrzedne")
