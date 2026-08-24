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

# 1. import sharp
old_1 = "import PDFDocument from 'pdfkit';"
new_1 = "import PDFDocument from 'pdfkit';\nimport sharp from 'sharp';"
content = replace_once("import sharp", old_1, new_1, content)

# 2. helper applyAiBadge (wektorowa ikonka AI, bez fontu - unikamy problemu jak z emoji)
old_2 = "async function fetchImageBuffer(url) {"
new_2 = """function aiBadgeSvg(size) {
  return Buffer.from(
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="12" cy="12" r="12" fill="black" fill-opacity="0.72"/>' +
    '<path d="M12 4 L14 10 L20 12 L14 14 L12 20 L10 14 L4 12 L10 10 Z" fill="white"/>' +
    '</svg>'
  );
}

async function applyAiBadge(buf) {
  try {
    const img = sharp(buf);
    const meta = await img.metadata();
    const w = meta.width || 800;
    const h = meta.height || 800;
    const badgeSize = Math.max(16, Math.round(w * 0.035));
    const margin = Math.max(6, Math.round(w * 0.025));
    const badgeSvg = aiBadgeSvg(badgeSize);
    return await img.composite([{ input: badgeSvg, left: w - badgeSize - margin, top: h - badgeSize - margin }]).toBuffer();
  } catch (e) {
    console.error('applyAiBadge:', e.message);
    return buf;
  }
}

async function fetchImageBuffer(url) {"""
content = replace_once("helper applyAiBadge + aiBadgeSvg", old_2, new_2, content)

# 3. ZIP: warunkowe wypalenie badge
old_3 = """            const buf = Buffer.from(await imgResp.arrayBuffer());
            const ext = /\\.jpe?g(\\?|$)/i.test(p.thumb) ? 'jpg' : 'png';
            archive.append(buf, { name: folderName + '/grafika.' + ext });"""
new_3 = """            let buf = Buffer.from(await imgResp.arrayBuffer());
            if (p.aiLabelEnabled) buf = await applyAiBadge(buf);
            const ext = /\\.jpe?g(\\?|$)/i.test(p.thumb) ? 'jpg' : 'png';
            archive.append(buf, { name: folderName + '/grafika.' + ext });"""
content = replace_once("ZIP: aplikuj badge jesli aiLabelEnabled", old_3, new_3, content)

# 4. WORD: warunkowe wypalenie badge
old_4 = """      if (p.thumb) {
        const buf = await fetchImageBuffer(p.thumb);
        if (buf) {
          try {
            const dim = imageSize(buf);"""
new_4 = """      if (p.thumb) {
        let buf = await fetchImageBuffer(p.thumb);
        if (buf && p.aiLabelEnabled) buf = await applyAiBadge(buf);
        if (buf) {
          try {
            const dim = imageSize(buf);"""
content = replace_once("WORD: aplikuj badge jesli aiLabelEnabled", old_4, new_4, content)

# 5. PDF: warunkowe wypalenie badge
old_5 = """      if (p.thumb) {
        const buf = await fetchImageBuffer(p.thumb);
        if (buf) {
          try {
            doc.image(buf, { fit: [500, 350] });"""
new_5 = """      if (p.thumb) {
        let buf = await fetchImageBuffer(p.thumb);
        if (buf && p.aiLabelEnabled) buf = await applyAiBadge(buf);
        if (buf) {
          try {
            doc.image(buf, { fit: [500, 350] });"""
content = replace_once("PDF: aplikuj badge jesli aiLabelEnabled", old_5, new_5, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
