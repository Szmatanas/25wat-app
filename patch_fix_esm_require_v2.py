import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = "import pdfParse from 'pdf-parse';"
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"
NEW = "import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);\nconst pdfParse = require('pdf-parse');"
content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: pdf-parse zaimportowany przez createRequire (poprawny sposob dla CJS-only paczek w ESM)")
