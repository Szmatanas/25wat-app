import io

PATH = "server.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

OLD_ANCHOR = "    const generatedSlides = await Promise.all(slides.map(async (slide, i) => {\n"
OLD_LINE = "      const carouselInstruction = `To jest SLAJD ${i + 1} z ${slides.length} karuzeli. Wszystkie slajdy tej karuzeli generowane sa rownolegle na podstawie tych samych referencji i tej samej pary kolorow - zachowaj IDENTYCZNY styl wizualny (typografia, kompozycja, elementy graficzne) jak w referencjach, tak zeby caly zestaw wygladal jednolicie.`;\n"

assert content.count(OLD_ANCHOR) == 1, f"OLD_ANCHOR count = {content.count(OLD_ANCHOR)}"
assert content.count(OLD_LINE) == 1, f"OLD_LINE count = {content.count(OLD_LINE)}"

VARIANTS_DECL = '''    const COMPOSITION_VARIANTS = [
      "Naglowek w GORNEJ czesci kadru, flubber w PRAWYM DOLNYM rogu, doodle-strzalka wskazujaca z lewej gory na naglowek.",
      "Naglowek WYSRODKOWANY PO LEWEJ (srodek wysokosci kadru), flubber w LEWYM DOLNYM rogu, doodle-underline podkreslajacy kluczowe slowo w naglowku.",
      "Naglowek w DOLNEJ czesci kadru, flubber w PRAWYM GORNYM rogu, doodle-sparkle przy kluczowym slowie lub liczbie.",
      "Naglowek PO PRAWEJ stronie kadru, flubber na dole PO SRODKU, doodle-strzalka skierowana ukosnie od naglowka w dol.",
      "Naglowek w GORNEJ czesci PO LEWEJ, flubber przesuniety w PRAWY SRODEK kadru (nie w rogu), doodle-circle lub x-mark jako akcent przy liczbie/slowie kluczowym."
    ];
'''

NEW_LINE = '''      const compositionVariant = COMPOSITION_VARIANTS[i % COMPOSITION_VARIANTS.length];
      const carouselInstruction = `To jest SLAJD ${i + 1} z ${slides.length} karuzeli. UZYJ TEJ SAMEJ pary kolorow, tej samej rodziny fontu i tego samego charakteru grafiki jak w referencjach - to musi wygladac jak jeden, konsekwentny zestaw. ALE nie powtarzaj identycznego ukladu na kazdym slajdzie - zastosuj TA KONKRETNA kompozycje dla tego slajdu: ${compositionVariant}`;
'''

content = content.replace(OLD_ANCHOR, VARIANTS_DECL + OLD_ANCHOR, 1)
content = content.replace(OLD_LINE, NEW_LINE, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: dodano COMPOSITION_VARIANTS i podmieniono carouselInstruction")
