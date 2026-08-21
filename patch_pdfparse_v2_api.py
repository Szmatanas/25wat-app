import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_1 = """import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');"""
assert content.count(ANCHOR_1) == 1, f"ANCHOR_1 count = {content.count(ANCHOR_1)}"
NEW_1 = """import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');"""
content = content.replace(ANCHOR_1, NEW_1, 1)

ANCHOR_2 = """      try {
        const parsed = await pdfParse(fileBuffer);
        finalTextContent = (parsed.text || '').trim().slice(0, 50000);
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tekstu z PDF (moze to skan bez warstwy tekstowej).' });
        }
        fileBuffer = null;
      } catch (pdfErr) {
        console.error('pdf-parse:', pdfErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc PDF: ' + pdfErr.message });"""
assert content.count(ANCHOR_2) == 1, f"ANCHOR_2 count = {content.count(ANCHOR_2)}"
NEW_2 = """      try {
        const parser = new PDFParse({ data: fileBuffer });
        const parsed = await parser.getText();
        await parser.destroy();
        finalTextContent = (parsed.text || '').trim().slice(0, 50000);
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tekstu z PDF (moze to skan bez warstwy tekstowej).' });
        }
        fileBuffer = null;
      } catch (pdfErr) {
        console.error('pdf-parse:', pdfErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc PDF: ' + pdfErr.message });"""
content = content.replace(ANCHOR_2, NEW_2, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: pdf-parse v2 API (klasa PDFParse + getText() + destroy())")
