import io

PATH = "server.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

START = 442
END = 479

start_idx = START - 1
end_idx = END - 1

assert lines[start_idx].strip() == "const generatedSlides = [];", \
    f"Linia {START} nie jest tym co oczekiwano: {lines[start_idx]!r}"
assert lines[end_idx].strip() == "}", \
    f"Linia {END} nie jest tym co oczekiwano: {lines[end_idx]!r}"

new_block = '''    const generatedSlides = await Promise.all(slides.map(async (slide, i) => {
      const headlineInstruction = `Uzyj DOKLADNIE tego headline, nie zmieniaj tresci: "${slide.headline}"` + (slide.subtext ? ` Podtekst/dodatkowa linia: "${slide.subtext}"` : '');
      const carouselInstruction = `To jest SLAJD ${i + 1} z ${slides.length} karuzeli. Wszystkie slajdy tej karuzeli generowane sa rownolegle na podstawie tych samych referencji i tej samej pary kolorow - zachowaj IDENTYCZNY styl wizualny (typografia, kompozycja, elementy graficzne) jak w referencjach, tak zeby caly zestaw wygladal jednolicie.`;
      const prompt = `${schemaText}\\n\\n---\\n\\n${colorInstruction}\\n${headlineInstruction}\\n\\n${carouselInstruction}\\n${photoInstruction}\\n${styleInstruction}\\n\\nTresc calego posta (kontekst):\\n${postText}\\n\\nPrzygotuj grafike TEGO SLAJDU zgodnie ze schematem, referencjami i powyzszymi instrukcjami.`;

      const imageContentParts = [...baseReferenceParts];
      if (photoPart) imageContentParts.push(photoPart);

      const promptForApi = prompt + '\\n\\nWygeneruj teraz obraz tego slajdu przy uzyciu narzedzia image_generation. Nie odpowiadaj tekstem - wywolaj narzedzie i zwroc obraz.';

      const responsesReq = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: 'gpt-5',
          input: [{ role: 'user', content: [{ type: 'input_text', text: promptForApi }, ...imageContentParts] }],
          tools: [{ type: 'image_generation', size }],
          tool_choice: { type: 'image_generation' }
        })
      });
      const respData = await responsesReq.json();
      if (respData.error) throw new Error(`OpenAI (slajd ${i + 1}): ` + respData.error.message);
      const imgCall = (respData.output || []).find(item => item.type === 'image_generation_call');
      if (!imgCall || !imgCall.result) throw new Error(`OpenAI nie zwrocil obrazu dla slajdu ${i + 1}`);
      const b64 = imgCall.result;
      const imageDataUrl = 'data:image/png;base64,' + b64;

      return { image: imageDataUrl, headline: slide.headline, subtext: slide.subtext || '' };
    }));
'''

new_lines = lines[:start_idx] + [new_block] + lines[end_idx + 1:]

with io.open(PATH, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("OK: zamieniono linie", START, "-", END)
