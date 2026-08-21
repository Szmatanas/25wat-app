import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_1 = """const TEXT_CATEGORIES = ['ai_context', 'ai_context_rules', 'brand_context', 'tone_of_voice', 'trends_focus', 'competitors'];"""
assert content.count(ANCHOR_1) == 1, f"ANCHOR_1 count = {content.count(ANCHOR_1)}"
NEW_1 = """const TEXT_CATEGORIES = ['ai_context', 'ai_context_rules', 'brand_context', 'tone_of_voice', 'trends_focus', 'competitors', 'brandbook'];"""
content = content.replace(ANCHOR_1, NEW_1, 1)

ANCHOR_2 = """    const ctxRes = await pool.query(
      "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'ai_context' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const aiContextText = ctxRes.rows[0] ? ctxRes.rows[0].text_content : '';

    const hexMatches = [...new Set((aiContextText.match(/#[0-9A-Fa-f]{6}/g) || []).map(h => h.toUpperCase()))];"""
assert content.count(ANCHOR_2) == 1, f"ANCHOR_2 count = {content.count(ANCHOR_2)}"

NEW_2 = """    const ctxRes = await pool.query(
      "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'ai_context' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const bookRes = await pool.query(
      "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'brandbook' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const brandbookText = bookRes.rows[0] ? bookRes.rows[0].text_content : '';
    const aiContextText = (brandbookText ? ('BRANDBOOK:\\n' + brandbookText + '\\n\\n') : '') + (ctxRes.rows[0] ? ctxRes.rows[0].text_content : '');

    const hexMatches = [...new Set((aiContextText.match(/#[0-9A-Fa-f]{6}/g) || []).map(h => h.toUpperCase()))];"""

content = content.replace(ANCHOR_2, NEW_2, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: brandbook (PDF/PNG/JPG) jest teraz parsowany i wchodzi do ekstrakcji kolorow + kontekstu stylu")
