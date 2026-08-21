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

# ============================================================
# Nowy endpoint: upload wlasnego zdjecia usera do Vercel Blob
# ============================================================
old_1 = "app.post('/api/design/generate-photo', async (req, res) => {"
new_1 = """app.post('/api/design/upload-photo', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Brak imageBase64' });
    const match = /^data:image\\/(png|jpe?g);base64,(.+)$/.exec(imageBase64);
    if (!match) return res.status(400).json({ error: 'Nieprawidlowy format obrazu (oczekiwano data:image/png|jpeg;base64,...)' });
    const ext = match[1] === 'jpg' ? 'jpeg' : match[1];
    const url = await uploadImageToBlob(match[2], ext);
    res.json({ url });
  } catch(e) {
    console.error('upload-photo:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/design/generate-photo', async (req, res) => {"""
content = replace_once("nowy endpoint POST /api/design/upload-photo", old_1, new_1, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
