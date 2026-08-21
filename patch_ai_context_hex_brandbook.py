import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_1 = """    const textResult = await pool.query(
      "SELECT category, text_content FROM brand_assets WHERE project_id = $1 AND category IN ('brand_context','tone_of_voice') AND text_content IS NOT NULL ORDER BY created_at DESC",
      [req.projectId]
    );"""
assert content.count(ANCHOR_1) == 1, f"ANCHOR_1 count = {content.count(ANCHOR_1)}"
NEW_1 = """    const textResult = await pool.query(
      "SELECT category, text_content FROM brand_assets WHERE project_id = $1 AND category IN ('brand_context','tone_of_voice','brandbook') AND text_content IS NOT NULL ORDER BY created_at DESC",
      [req.projectId]
    );"""
content = content.replace(ANCHOR_1, NEW_1, 1)

ANCHOR_2 = """    if (!byCat.brand_context && !byCat.tone_of_voice) {
      return res.status(400).json({ error: 'Wgraj najpierw Brand Strategy lub Tone of Voice (tekst albo plik) - AI potrzebuje materialu zrodlowego.' });
    }"""
assert content.count(ANCHOR_2) == 1, f"ANCHOR_2 count = {content.count(ANCHOR_2)}"
NEW_2 = """    if (!byCat.brand_context && !byCat.tone_of_voice && !byCat.brandbook) {
      return res.status(400).json({ error: 'Wgraj najpierw Brandbook, Brand Strategy lub Tone of Voice (tekst albo plik) - AI potrzebuje materialu zrodlowego.' });
    }"""
content = content.replace(ANCHOR_2, NEW_2, 1)

ANCHOR_3 = """Na podstawie materialow zrodlowych klienta (brand strategy, tone of voice, przykladowe kreacje graficzne) zbuduj DOKUMENT "AI CONTEXT" ktory bedzie zasilal generowanie tresci i grafik dla tej marki.\\n\\nStruktura dokumentu"""
assert content.count(ANCHOR_3) == 1, f"ANCHOR_3 count = {content.count(ANCHOR_3)}"
NEW_3 = """Na podstawie materialow zrodlowych klienta (brandbook, brand strategy, tone of voice, przykladowe kreacje graficzne) zbuduj DOKUMENT "AI CONTEXT" ktory bedzie zasilal generowanie tresci i grafik dla tej marki. Jesli w materialach jest sekcja BRANDBOOK - to zrodlo najwyzszego priorytetu, nadrzedne wobec wnioskow wyciaganych z samych zdjec.\\n\\nStruktura dokumentu"""
content = content.replace(ANCHOR_3, NEW_3, 1)

ANCHOR_4 = """## PALETA KOLOROW\\n- Jesli widac kolory na przykladowych grafikach - wypisz je opisowo. Jesli brak grafik - napisz "brak danych - pomin, dopisac pozniej"."""
assert content.count(ANCHOR_4) == 1, f"ANCHOR_4 count = {content.count(ANCHOR_4)}"
NEW_4 = """## PALETA KOLOROW\\n- KONIECZNIE podaj dokladny kod HEX (#RRGGBB) dla kazdego koloru, obok jego nazwy (np. "Rozowy/malinowy #E6007E"). Jesli w BRANDBOOK sa podane kody HEX - uzyj ich dokladnie, nie szacuj. Jesli nie ma HEX w tekscie ale widac kolory na przykladowych grafikach - oszacuj najblizszy kod HEX i zawsze go podaj - nigdy nie ograniczaj sie do samej nazwy slownej koloru. Jesli brak jakichkolwiek danych o kolorach - napisz "brak danych - pomin, dopisac pozniej"."""
content = content.replace(ANCHOR_4, NEW_4, 1)

ANCHOR_5 = """    const contentBlocks = [];
    if (byCat.brand_context) contentBlocks.push({ type: 'text', text: 'BRAND STRATEGY:\\n' + byCat.brand_context });"""
assert content.count(ANCHOR_5) == 1, f"ANCHOR_5 count = {content.count(ANCHOR_5)}"
NEW_5 = """    const contentBlocks = [];
    if (byCat.brandbook) contentBlocks.push({ type: 'text', text: 'BRANDBOOK (zrodlo najwyzszego priorytetu):\\n' + byCat.brandbook });
    if (byCat.brand_context) contentBlocks.push({ type: 'text', text: 'BRAND STRATEGY:\\n' + byCat.brand_context });"""
content = content.replace(ANCHOR_5, NEW_5, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: generator AI Context czyta brandbook jako priorytet i wymusza kody HEX kolorow")
