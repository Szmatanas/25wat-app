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

# 1. helper do usuwania emoji (Gilroy ich nie ma, w PDF wychodzily jako krzaki)
old_1 = "async function fetchImageBuffer(url) {"
new_1 = """function stripEmoji(s) {
  return (s || '')
    .replace(/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2190}-\\u{21FF}\\u{2B00}-\\u{2BFF}\\u{FE0F}\\u{200D}]/gu, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

async function fetchImageBuffer(url) {"""
content = replace_once("helper stripEmoji", old_1, new_1, content)

# 2. rejestracja fontu Gilroy w PDF + uzycie go + strip emoji z tekstow
old_2 = """    const doc = new PDFDocument({ size: 'A4', margin: 40 });
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
    doc.end();"""
new_2 = """    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.registerFont('Gilroy', path.join(__dirname, 'assets/fonts/Gilroy-Regular.otf'));
    doc.registerFont('Gilroy-Bold', path.join(__dirname, 'assets/fonts/Gilroy-SemiBold.otf'));
    doc.pipe(res);
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i] || {};
      const num = String(i + 1).padStart(2, '0');
      const chLabel = (p.channel || 'fb').toUpperCase();
      if (i > 0) doc.addPage();
      doc.font('Gilroy-Bold').fontSize(16).fillColor('#000000').text(num + ' — ' + chLabel + (p.title ? ' — ' + stripEmoji(p.title) : ''));
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
      doc.font('Gilroy').fontSize(11).fillColor('#333333').text(stripEmoji(p.content || ''));
    }
    doc.end();"""
content = replace_once("PDF: font Gilroy (polskie znaki) + usuniecie emoji przed renderem", old_2, new_2, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
