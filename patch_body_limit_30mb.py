import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = "app.use(express.json({ limit: '15mb' }));"
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"

NEW = """app.use(express.json({ limit: '30mb' }));
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Plik za duzy. Maksymalny rozmiar pliku to 20MB.' });
  }
  next(err);
});"""

content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: limit body podniesiony do 30MB + czytelny komunikat 413")
