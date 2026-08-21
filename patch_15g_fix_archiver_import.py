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

old_1 = "import { put } from '@vercel/blob';\nimport archiver from 'archiver';"
new_1 = "import { put } from '@vercel/blob';"
content = replace_once("usun bledny 'import archiver'", old_1, new_1, content)

old_2 = "const { PDFParse } = require('pdf-parse');"
new_2 = "const { PDFParse } = require('pdf-parse');\nconst archiver = require('archiver');"
content = replace_once("archiver przez require() (CommonJS)", old_2, new_2, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
