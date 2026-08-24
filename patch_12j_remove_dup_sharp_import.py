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

old_1 = "import sharp from 'sharp';\nimport fs from 'fs';"
new_1 = "import fs from 'fs';"
content = replace_once("usun zdublowany import sharp z linii 1", old_1, new_1, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

sharp_count = content.count("import sharp from 'sharp';")
print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
print(f"Liczba 'import sharp' po patchu: {sharp_count} (oczekiwane: 1)")
if changes_failed or sharp_count != 1:
    sys.exit(1)
