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

# 1. Zamien aiBadgeSvg + applyAiBadge (wektorowa ikonka) na wersje operujaca na realnych plikach PNG (3 warianty)
old_1 = """function aiBadgeSvg(size) {
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
}"""
new_1 = """const AI_BADGE_FILES = { ai: 'badge-ai.png', ai_generated: 'badge-ai-generated.png', ai_modified: 'badge-ai-modified.png' };

async function applyAiBadge(buf, variant) {
  try {
    if (!variant || !AI_BADGE_FILES[variant]) return buf;
    const img = sharp(buf);
    const meta = await img.metadata();
    const w = meta.width || 800;
    const h = meta.height || 800;
    const badgeWidth = Math.max(40, Math.round(w * 0.22));
    const margin = Math.max(6, Math.round(w * 0.025));
    const badgePath = path.join(__dirname, 'assets', 'badges', AI_BADGE_FILES[variant]);
    const badgeBuf = await sharp(badgePath).resize({ width: badgeWidth }).toBuffer();
    const badgeMeta = await sharp(badgeBuf).metadata();
    const badgeHeight = badgeMeta.height || badgeWidth;
    return await img.composite([{ input: badgeBuf, left: w - badgeWidth - margin, top: h - badgeHeight - margin }]).toBuffer();
  } catch (e) {
    console.error('applyAiBadge:', e.message);
    return buf;
  }
}"""
content = replace_once("applyAiBadge: realne pliki PNG (3 warianty) zamiast wektorowej ikonki", old_1, new_1, content)

# 2. ZIP: przekazanie wariantu
old_2 = "if (p.aiLabelEnabled) buf = await applyAiBadge(buf);"
new_2 = "if (p.aiLabelVariant) buf = await applyAiBadge(buf, p.aiLabelVariant);"
content = replace_once("ZIP: applyAiBadge z wariantem", old_2, new_2, content)

# 3. WORD: przekazanie wariantu
old_3 = "if (buf && p.aiLabelEnabled) buf = await applyAiBadge(buf);"
new_3 = "if (buf && p.aiLabelVariant) buf = await applyAiBadge(buf, p.aiLabelVariant);"
count3 = content.count(old_3)
if count3 == 2:
    content = content.replace(old_3, new_3)
    changes_applied.append("WORD+PDF: applyAiBadge z wariantem (2x)")
    print("[OK]   WORD+PDF: applyAiBadge z wariantem (2x)")
else:
    changes_failed.append(("WORD+PDF: applyAiBadge z wariantem", count3))
    print(f"[FAIL] WORD+PDF: applyAiBadge z wariantem: znaleziono {count3}x (oczekiwano 2x) — SKIP")

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
