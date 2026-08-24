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

old_1 = """    const badgeWidth = Math.max(40, Math.round(w * 0.13));
    const margin = Math.max(6, Math.round(w * 0.025));"""
new_1 = """    const badgeWidth = Math.max(40, Math.round(w * 0.09));
    const margin = Math.max(6, Math.round(w * 0.022));"""
content = replace_once("applyAiBadge: finalny rozmiar (0.13 -> 0.09)", old_1, new_1, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
