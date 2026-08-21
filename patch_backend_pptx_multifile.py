import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_1 = """const { PDFParse } = require('pdf-parse');"""
assert content.count(ANCHOR_1) == 1, f"ANCHOR_1 count = {content.count(ANCHOR_1)}"
NEW_1 = """const { PDFParse } = require('pdf-parse');
const { parseOffice } = require('officeparser');"""
content = content.replace(ANCHOR_1, NEW_1, 1)

ANCHOR_2 = """    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType.startsWith('image/')) {"""
assert content.count(ANCHOR_2) == 1, f"ANCHOR_2 count = {content.count(ANCHOR_2)}"
NEW_2 = """    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      try {
        const ast = await parseOffice(fileBuffer, { fileType: 'pptx' });
        finalTextContent = (ast.toText() || '').trim().slice(0, 50000);
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tekstu z prezentacji PowerPoint.' });
        }
        fileBuffer = null;
      } catch (pptErr) {
        console.error('officeparser pptx:', pptErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc pliku PowerPoint: ' + pptErr.message });
      }
    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType.startsWith('image/')) {"""
content = content.replace(ANCHOR_2, NEW_2, 1)

ANCHOR_3 = """    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType !== 'text/plain' && mimeType !== 'text/markdown' && !mimeType.startsWith('text/')) {
      return res.status(400).json({ error: 'Ten kafelek przyjmuje tekst (.txt, .md), PDF lub obraz (PNG/JPG).' });
    }"""
assert content.count(ANCHOR_3) == 1, f"ANCHOR_3 count = {content.count(ANCHOR_3)}"
NEW_3 = """    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType !== 'text/plain' && mimeType !== 'text/markdown' && !mimeType.startsWith('text/')) {
      return res.status(400).json({ error: 'Ten kafelek przyjmuje tekst (.txt, .md), PDF, PowerPoint (.pptx) lub obraz (PNG/JPG).' });
    }"""
content = content.replace(ANCHOR_3, NEW_3, 1)

ANCHOR_4 = """    const byCat = {};
    textResult.rows.forEach(r => { if (!byCat[r.category]) byCat[r.category] = r.text_content; });"""
assert content.count(ANCHOR_4) == 1, f"ANCHOR_4 count = {content.count(ANCHOR_4)}"
NEW_4 = """    const byCat = {};
    textResult.rows.forEach(r => {
      if (!byCat[r.category]) byCat[r.category] = [];
      byCat[r.category].push(r.text_content);
    });
    Object.keys(byCat).forEach(k => { byCat[k] = byCat[k].join('\\n\\n---\\n\\n'); });"""
content = content.replace(ANCHOR_4, NEW_4, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: PPTX (officeparser) obslugiwany w kategoriach tekstowych; generate-ai-context czyta wszystkie wgrane pliki danej kategorii")
