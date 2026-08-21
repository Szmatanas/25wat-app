import io

PATH = "server.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_ENDPOINT = """app.post('/api/content/generate', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'Brak tematu' });
  try {"""

assert content.count(ANCHOR_ENDPOINT) == 1, f"ANCHOR_ENDPOINT count = {content.count(ANCHOR_ENDPOINT)}"

HELPER = """async function getProjectBrandContext(projectId) {
  if (!projectId) return null;
  try {
    const result = await pool.query(
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
    return parts.length ? parts.join('\\n\\n') : null;
  } catch (e) {
    console.error('getProjectBrandContext:', e.message);
    return null;
  }
}

"""

NEW_ENDPOINT = """app.post('/api/content/generate', async (req, res) => {
  const { topic, projectId } = req.body;
  if (!topic) return res.status(400).json({ error: 'Brak tematu' });
  try {
    const customBrandContext = await getProjectBrandContext(projectId);
    const systemPrompt = customBrandContext
      ? customBrandContext + '\\n\\n---\\n\\nPisz posty na Facebook po polsku, zgodnie z powyzszym kontekstem marki (strategia, tone of voice).'
      : BRAND_VOICE;"""

content = content.replace(ANCHOR_ENDPOINT, HELPER + NEW_ENDPOINT, 1)

ANCHOR_CALL = "system: BRAND_VOICE, messages: [{ role: 'user', content: prompt }] })"
assert content.count(ANCHOR_CALL) == 1, f"ANCHOR_CALL count = {content.count(ANCHOR_CALL)}"
NEW_CALL = "system: systemPrompt, messages: [{ role: 'user', content: prompt }] })"
content = content.replace(ANCHOR_CALL, NEW_CALL, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: content/generate czyta brand_context/tone_of_voice/ai_context z projektu, fallback na BRAND_VOICE")
