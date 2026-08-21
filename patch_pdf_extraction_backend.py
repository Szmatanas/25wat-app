import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_REQUIRE = "app.use(express.json({ limit: '30mb' }));"
assert content.count(ANCHOR_REQUIRE) == 1, f"ANCHOR_REQUIRE count = {content.count(ANCHOR_REQUIRE)}"
NEW_REQUIRE = "const pdfParse = require('pdf-parse');\napp.use(express.json({ limit: '30mb' }));"
content = content.replace(ANCHOR_REQUIRE, NEW_REQUIRE, 1)

ANCHOR_UPLOAD = """app.post('/api/projects/:projectId/assets', requireAuth, requireProjectMember, async (req, res) => {
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
});"""
assert content.count(ANCHOR_UPLOAD) == 1, f"ANCHOR_UPLOAD count = {content.count(ANCHOR_UPLOAD)}"

NEW_UPLOAD = """const TEXT_CATEGORIES = ['ai_context', 'ai_context_rules', 'brand_context', 'tone_of_voice', 'trends_focus', 'competitors'];

app.post('/api/projects/:projectId/assets', requireAuth, requireProjectMember, async (req, res) => {
  const { category, filename, mimeType, fileBase64, textContent, metadata } = req.body;
  if (!category) return res.status(400).json({ error: 'Brak category' });
  try {
    let fileBuffer = null;
    let finalTextContent = textContent || null;
    if (fileBase64) {
      const b64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      fileBuffer = Buffer.from(b64, 'base64');
    }
    if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType === 'application/pdf') {
      try {
        const parsed = await pdfParse(fileBuffer);
        finalTextContent = (parsed.text || '').trim().slice(0, 50000);
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tekstu z PDF (moze to skan bez warstwy tekstowej).' });
        }
        fileBuffer = null;
      } catch (pdfErr) {
        console.error('pdf-parse:', pdfErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc PDF: ' + pdfErr.message });
      }
    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType !== 'text/plain' && mimeType !== 'text/markdown' && !mimeType.startsWith('text/')) {
      return res.status(400).json({ error: 'Ten kafelek przyjmuje tylko tekst (.txt, .md) lub PDF. Zdjecia wgraj w kategorii "Przyklady kompozycji" albo "Logo".' });
    }
    const result = await pool.query(
      `INSERT INTO brand_assets (project_id, category, filename, mime_type, file_data, text_content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category, filename, mime_type, text_content, metadata, created_at`,
      [req.projectId, category, filename || null, mimeType || null, fileBuffer, finalTextContent, JSON.stringify(metadata || {})]
    );
    res.json({ asset: result.rows[0] });
  } catch (e) {
    console.error('upload asset:', e.message);
    res.status(500).json({ error: e.message });
  }
});"""

content = content.replace(ANCHOR_UPLOAD, NEW_UPLOAD, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: PDF w kategoriach tekstowych jest parsowany serwerowo (pdf-parse), obrazy/inne binarki odrzucane z komunikatem")
