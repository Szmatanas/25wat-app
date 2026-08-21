import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = "const pdfParse = require('pdf-parse');"
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"
NEW = "import pdfParse from 'pdf-parse';"
content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: require() zamienione na import - naprawia crash ES module na Railway")
