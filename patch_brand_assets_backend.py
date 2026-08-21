import io

PATH = "server.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """app.put('/api/projects/:projectId/state/:key', requireAuth, requireProjectMember, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'Brak value' });
  try {
    await pool.query(
      `INSERT INTO project_state (project_id, key, value, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (project_id, key) DO UPDATE SET value = $3, updated_at = now()`,
      [req.projectId, key, JSON.stringify(value)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('put project state:', e.message);
    res.status(500).json({ error: e.message });
  }
});"""

assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"

NEW = ANCHOR + """

app.get('/api/projects/:projectId/assets', requireAuth, requireProjectMember, async (req, res) => {
  const { category } = req.query;
  try {
    const params = [req.projectId];
    let sql = 'SELECT id, category, filename, mime_type, text_content, metadata, created_at FROM brand_assets WHERE project_id = $1';
    if (category) { params.push(category); sql += ' AND category = $2'; }
    sql += ' ORDER BY created_at DESC';
    const result = await pool.query(sql, params);
    res.json({ assets: result.rows });
  } catch (e) {
    console.error('list assets:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:projectId/assets', requireAuth, requireProjectMember, async (req, res) => {
  const { category, filename, mimeType, fileBase64, textContent, metadata } = req.body;
  if (!category) return res.status(400).json({ error: 'Brak category' });
  try {
    let fileBuffer = null;
    if (fileBase64) {
      const b64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      fileBuffer = Buffer.from(b64, 'base64');
    }
    const result = await pool.query(
      `INSERT INTO brand_assets (project_id, category, filename, mime_type, file_data, text_content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category, filename, mime_type, text_content, metadata, created_at`,
      [req.projectId, category, filename || null, mimeType || null, fileBuffer, textContent || null, JSON.stringify(metadata || {})]
    );
    res.json({ asset: result.rows[0] });
  } catch (e) {
    console.error('upload asset:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects/:projectId/assets/:assetId/file', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_data, mime_type, filename FROM brand_assets WHERE id = $1 AND project_id = $2',
      [req.params.assetId, req.projectId]
    );
    const row = result.rows[0];
    if (!row || !row.file_data) return res.status(404).json({ error: 'Plik nie znaleziony' });
    res.set('Content-Type', row.mime_type || 'application/octet-stream');
    res.send(row.file_data);
  } catch (e) {
    console.error('get asset file:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/projects/:projectId/assets/:assetId', requireAuth, requireProjectMember, async (req, res) => {
  try {
    await pool.query('DELETE FROM brand_assets WHERE id = $1 AND project_id = $2', [req.params.assetId, req.projectId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('delete asset:', e.message);
    res.status(500).json({ error: e.message });
  }
});"""

content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: dodano endpointy brand_assets (list/upload/file/delete)")
