import io, sys

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

old = "const SIZE_MAP = { 'post-1-1': '1024x1024', 'post-4-5': '1024x1536', 'story': '1024x1536' };"
new = "const SIZE_MAP = { 'post-1-1': '1024x1024', 'post-4-5': '1024x1536', 'story': '1024x1536', 'landscape': '1536x1024' };"

count = content.count(old)
if count != 2:
    print(f"[FAIL] SIZE_MAP: znaleziono {count}x (oczekiwano 2x)")
    sys.exit(1)
content = content.replace(old, new)
with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)
print(f"[OK] SIZE_MAP zaktualizowany w {count} miejscach: dodano 'landscape': '1536x1024'")
