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

old_1 = "import { put } from '@vercel/blob';"
new_1 = "import { put } from '@vercel/blob';\nimport archiver from 'archiver';"
content = replace_once("import archiver", old_1, new_1, content)

old_2 = "app.post('/api/design/upload-photo', async (req, res) => {"
new_2 = """app.post('/api/projects/:projectId/export/zip', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts) || !posts.length) return res.status(400).json({ error: 'Brak postow do eksportu' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="25wat-eksport.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', function(err) { console.error('archiver error:', err.message); });
    archive.pipe(res);
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i] || {};
      const num = String(i + 1).padStart(2, '0');
      const chLabel = (p.channel || 'fb').toUpperCase();
      const safeTitle = (p.title || 'post').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'post';
      const baseName = num + '_' + chLabel + '_' + safeTitle;
      archive.append(p.content || '', { name: baseName + '.txt' });
      if (p.thumb) {
        try {
          const imgResp = await fetch(p.thumb);
          if (imgResp.ok) {
            const buf = Buffer.from(await imgResp.arrayBuffer());
            const ext = /\\.jpe?g(\\?|$)/i.test(p.thumb) ? 'jpg' : 'png';
            archive.append(buf, { name: baseName + '.' + ext });
          }
        } catch (e) { console.error('export/zip image fetch:', e.message); }
      }
    }
    await archive.finalize();
  } catch (e) {
    console.error('export/zip:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

app.post('/api/design/upload-photo', async (req, res) => {"""
content = replace_once("nowy endpoint POST /api/projects/:projectId/export/zip", old_2, new_2, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
