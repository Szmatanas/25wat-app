import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """    const result = await pool.query(
      `INSERT INTO brand_assets (project_id, category, filename, mime_type, file_data, text_content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category, filename, mime_type, text_content, metadata, created_at`,
      [req.projectId, category, filename || null, mimeType || null, fileBuffer, finalTextContent, JSON.stringify(metadata || {})]
    );
    res.json({ asset: result.rows[0] });"""
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"

NEW = """    const SINGLETON_CATEGORIES = ['ai_context', 'ai_context_rules'];
    if (SINGLETON_CATEGORIES.includes(category)) {
      await pool.query('DELETE FROM brand_assets WHERE project_id = $1 AND category = $2', [req.projectId, category]);
    }
    const result = await pool.query(
      `INSERT INTO brand_assets (project_id, category, filename, mime_type, file_data, text_content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category, filename, mime_type, text_content, metadata, created_at`,
      [req.projectId, category, filename || null, mimeType || null, fileBuffer, finalTextContent, JSON.stringify(metadata || {})]
    );
    res.json({ asset: result.rows[0] });"""
content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: ai_context / ai_context_rules jako singleton - stary wiersz usuwany przed zapisem nowego")
