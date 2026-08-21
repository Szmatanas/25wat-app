import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """    const namedColorRe = /\\*\\*([^*\\n]{2,40}?)\\*\\*\\s*`(#[0-9A-Fa-f]{6})`/g;
    const namedColors = [];
    const seenHex = new Set();
    let ncMatch;
    while ((ncMatch = namedColorRe.exec(aiContextText)) !== null) {
      const hex = ncMatch[2].toUpperCase();
      if (seenHex.has(hex)) continue;
      seenHex.add(hex);
      namedColors.push({ name: ncMatch[1].trim(), hex });
      if (namedColors.length >= 8) break;
    }"""
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"
NEW = """    const namedColors = [];
    const seenHexForNames = new Set();
    aiContextText.split('\\n').forEach(line => {
      if (namedColors.length >= 8) return;
      const nameMatch = line.match(/\\*\\*([^*\\n]{2,40}?)\\*\\*/);
      const hexMatch = line.match(/#[0-9A-Fa-f]{6}/);
      if (!nameMatch || !hexMatch) return;
      const hex = hexMatch[0].toUpperCase();
      if (seenHexForNames.has(hex)) return;
      seenHexForNames.add(hex);
      namedColors.push({ name: nameMatch[1].trim(), hex });
    });"""
content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: ekstrakcja nazwanych kolorow odporna na zmienna kolejnosc/format modelu")
