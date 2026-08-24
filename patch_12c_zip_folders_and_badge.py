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

old_1 = """      const baseName = num + '_' + chLabel + '_' + safeTitle;
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
      }"""
new_1 = """      const folderName = num + '_' + chLabel + '_' + safeTitle;
      archive.append(p.content || '', { name: folderName + '/tekst.txt' });
      if (p.thumb) {
        try {
          const imgResp = await fetch(p.thumb);
          if (imgResp.ok) {
            let buf = Buffer.from(await imgResp.arrayBuffer());
            if (p.aiLabelEnabled) buf = await applyAiBadge(buf);
            const ext = /\\.jpe?g(\\?|$)/i.test(p.thumb) ? 'jpg' : 'png';
            archive.append(buf, { name: folderName + '/grafika.' + ext });
          }
        } catch (e) { console.error('export/zip image fetch:', e.message); }
      }"""
content = replace_once("ZIP: folder per post + wypalenie badge AI", old_1, new_1, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
