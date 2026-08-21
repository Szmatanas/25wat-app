import io, sys

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

changes_applied = []
changes_failed = []

def replace_once(label, old, new, content):
    count = content.count(old)
    if count != 1:
        changes_failed.append((label, count))
        print(f"[FAIL] {label}: znaleziono {count}x (oczekiwano 1x) — SKIP")
        return content
    content = content.replace(old, new, 1)
    changes_applied.append(label)
    print(f"[OK]   {label}")
    return content

# 1. Importy nowych bibliotek
old_1 = "import { put } from '@vercel/blob';"
new_1 = """import { put } from '@vercel/blob';
import { Document, Packer, Paragraph, HeadingLevel, ImageRun, PageBreak } from 'docx';
import PDFDocument from 'pdfkit';
import { imageSize } from 'image-size';"""
content = replace_once("import docx/pdfkit/image-size", old_1, new_1, content)

# 2. Helper do pobierania obrazka jako Buffer (wspolny dla word/pdf)
old_2 = "async function uploadImageToBlob(b64, ext) {"
new_2 = """async function fetchImageBuffer(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch (e) {
    console.error('fetchImageBuffer:', e.message);
    return null;
  }
}

async function uploadImageToBlob(b64, ext) {"""
content = replace_once("helper fetchImageBuffer", old_2, new_2, content)

# 3. Nowe endpointy /export/word i /export/pdf - wstawione przed /export/zip
old_3 = "app.post('/api/projects/:projectId/export/zip', requireAuth, requireProjectMember, async (req, res) => {"
new_3 = """app.post('/api/projects/:projectId/export/word', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts) || !posts.length) return res.status(400).json({ error: 'Brak postow do eksportu' });
    const children = [];
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i] || {};
      const num = String(i + 1).padStart(2, '0');
      const chLabel = (p.channel || 'fb').toUpperCase();
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        text: num + ' — ' + chLabel + (p.title ? ' — ' + p.title : '')
      }));
      if (p.thumb) {
        const buf = await fetchImageBuffer(p.thumb);
        if (buf) {
          try {
            const dim = imageSize(buf);
            const maxW = 420;
            const scale = dim.width > maxW ? maxW / dim.width : 1;
            children.push(new Paragraph({
              children: [ new ImageRun({
                data: buf,
                transformation: { width: Math.round(dim.width * scale), height: Math.round(dim.height * scale) }
              }) ]
            }));
          } catch (e) { console.error('export/word image:', e.message); }
        }
      }
      children.push(new Paragraph({ text: p.content || '' }));
      if (i < posts.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="25wat-eksport.docx"');
    res.send(buffer);
  } catch (e) {
    console.error('export/word:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:projectId/export/pdf', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts) || !posts.length) return res.status(400).json({ error: 'Brak postow do eksportu' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="25wat-eksport.pdf"');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i] || {};
      const num = String(i + 1).padStart(2, '0');
      const chLabel = (p.channel || 'fb').toUpperCase();
      if (i > 0) doc.addPage();
      doc.fontSize(16).fillColor('#000000').text(num + ' — ' + chLabel + (p.title ? ' — ' + p.title : ''));
      doc.moveDown(0.5);
      if (p.thumb) {
        const buf = await fetchImageBuffer(p.thumb);
        if (buf) {
          try {
            doc.image(buf, { fit: [500, 350] });
            doc.moveDown(0.5);
          } catch (e) { console.error('export/pdf image:', e.message); }
        }
      }
      doc.fontSize(11).fillColor('#333333').text(p.content || '');
    }
    doc.end();
  } catch (e) {
    console.error('export/pdf:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:projectId/export/zip', requireAuth, requireProjectMember, async (req, res) => {"""
content = replace_once("nowe endpointy /export/word i /export/pdf", old_3, new_3, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
