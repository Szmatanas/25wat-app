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

old_1 = "  const { topic, projectId } = req.body;\n  if (!topic) return res.status(400).json({ error: 'Brak tematu' });"
new_1 = "  const { topic, projectId, channel } = req.body;\n  if (!topic) return res.status(400).json({ error: 'Brak tematu' });"
content = replace_once("destructure: dodanie 'channel' z req.body", old_1, new_1, content)

old_2 = """  if (!topic) return res.status(400).json({ error: 'Brak tematu' });
  try {
    const customBrandContext = await getProjectBrandContext(projectId);"""

new_2 = """  if (!topic) return res.status(400).json({ error: 'Brak tematu' });
  try {
    const CHANNEL_RULES = {
      fb: {
        label: 'Facebook',
        types: ['edukacyjny','storytelling','prowokacyjny','angażujący'],
        rules: `ZASADY FORMATU FB:
- Pierwsze zdanie to HOOK - ma zatrzymac scrollowanie, max 12 slow, zaczyna sie od liczby lub prowokacyjnego stwierdzenia
- Krotkie akapity: 1-2 zdania, oddzielone pustą linią
- Emoji jako separatory sekcji (nie dekoracja): uzyj 2-4 emoji w strategicznych miejscach
- Ostatnie zdanie to CTA lub pytanie do odbiorcy
- Dlugosc: 150-250 slow`,
        categories: `1. Edukacyjny - dane i liczby, lista punktow z emoji
2. Storytelling - historia klienta, konkretna sytuacja przed/po
3. Prowokacyjny - obalenie mitu lub kontrowersyjna teza
4. Angażujący - pytanie otwarte, zaproszenie do dyskusji`
      },
      ig: {
        label: 'Instagram',
        types: ['edukacyjny','behind-the-scenes','inspirujący','angażujący'],
        rules: `ZASADY FORMATU IG:
- Pierwsze zdanie to HOOK wizualny - krotki, konkretny, max 10 slow
- Prosty, lekki jezyk - lifestyle, bez korpomowy
- Krotkie akapity, mozna uzyc emoji jako akcentow (2-3, lekko)
- Ostatnie zdanie to CTA typu "zapisz/udostepnij/napisz w komentarzu"
- Dlugosc: 80-150 slow (Instagram = zwiezlosc i wizualnosc, nie esej)`,
        categories: `1. Edukacyjny - szybkie tipy, lista punktow
2. Behind-the-scenes - kulisy pracy, proces, ludzie za marka
3. Inspirujący - lifestyle, wartosci, krotka historia
4. Angażujący - pytanie/ankieta, zaproszenie do interakcji`
      },
      li: {
        label: 'LinkedIn',
        types: ['ekspercki','case-study','kontrariański','dyskusyjny'],
        rules: `ZASADY FORMATU LI:
- Pierwsze zdanie to HOOK ekspercki - obserwacja, dana lub teza branzowa, max 15 slow
- Ton biznesowy, ekspercki, bez emoji-dekoracji (max 0-2 emoji, subtelnie)
- Struktura: teza/obserwacja -> konkretny przyklad lub doswiadczenie -> wniosek
- Ostatnie zdanie to zaproszenie do dyskusji branzowej (pytanie do innych profesjonalistow)
- Dlugosc: 200-350 slow (LinkedIn = thought leadership, dluzsza forma OK)`,
        categories: `1. Ekspercki - dane, analiza, punkt widzenia oparty na doswiadczeniu
2. Case study - konkretny projekt/klient, sytuacja przed/po, mierzalny efekt
3. Kontrariański - podważenie powszechnej opinii w branzy, poparte argumentem
4. Dyskusyjny - pytanie do sieci kontaktow, zaproszenie do wymiany doswiadczen`
      }
    };
    const CHANNEL_ALIAS = { 'meta-ads': 'fb', 'li-ads': 'li' };
    const chKey = CHANNEL_ALIAS[channel] || channel;
    const ch = CHANNEL_RULES[chKey] || CHANNEL_RULES.fb;
    const customBrandContext = await getProjectBrandContext(projectId);"""

content = replace_once("wstrzykniecie CHANNEL_RULES/CHANNEL_ALIAS/ch", old_2, new_2, content)

old_3 = "      ? customBrandContext + '\\n\\n---\\n\\nPisz posty na Facebook po polsku, zgodnie z powyzszym kontekstem marki (strategia, tone of voice).'"
new_3 = "      ? customBrandContext + '\\n\\n---\\n\\nPisz posty na ' + ch.label + ' po polsku, zgodnie z powyzszym kontekstem marki (strategia, tone of voice).'"
content = replace_once("systemPrompt: dynamiczna nazwa platformy (ch.label)", old_3, new_3, content)

old_4 = """    const prompt = `Napisz 4 rozne propozycje postow na Facebook dla ${brandLabel} na temat: "${topic}".

ZASADY FORMATU FB:
- Pierwsze zdanie to HOOK - ma zatrzymac scrollowanie, max 12 slow, zaczyna sie od liczby lub prowokacyjnego stwierdzenia
- Krotkie akapity: 1-2 zdania, oddzielone pustą linią
- Emoji jako separatory sekcji (nie dekoracja): uzyj 2-4 emoji w strategicznych miejscach
- Ostatnie zdanie to CTA lub pytanie do odbiorcy
- Dlugosc: 150-250 slow

Kazda propozycja inny kat narracyjny:
1. Edukacyjny - dane i liczby, lista punktow z emoji
2. Storytelling - historia klienta, konkretna sytuacja przed/po
3. Prowokacyjny - obalenie mitu lub kontrowersyjna teza
4. Angażujący - pytanie otwarte, zaproszenie do dyskusji

Wazne zasady:
- W tresci uzyj punktorow jako • (kropka) nie jako myslniki
- Pierwsze zdanie bez imienia autora, bez "Czesc"

Odpowiedz TYLKO JSON bez markdown bez em-dash bez typograficznych cudzyslowow:
{"posts":[{"type":"edukacyjny","title":"max 5 slow","content":"tresc z enterami jako nowe linie"},{"type":"storytelling","title":"...","content":"..."},{"type":"prowokacyjny","title":"...","content":"..."},{"type":"angażujący","title":"...","content":"..."}]}`;"""

new_4 = """    const typesExample = ch.types.map((t, i) => i === 0
      ? '{"type":"' + t + '","title":"max 5 slow","content":"tresc z enterami jako nowe linie"}'
      : '{"type":"' + t + '","title":"...","content":"..."}'
    ).join(',');

    const prompt = `Napisz 4 rozne propozycje postow na ${ch.label} dla ${brandLabel} na temat: "${topic}".

${ch.rules}

Kazda propozycja inny kat narracyjny:
${ch.categories}

Wazne zasady:
- W tresci uzyj punktorow jako • (kropka) nie jako myslniki
- Pierwsze zdanie bez imienia autora, bez "Czesc"

Odpowiedz TYLKO JSON bez markdown bez em-dash bez typograficznych cudzyslowow:
{"posts":[${typesExample}]}`;"""

content = replace_once("prompt: platform-aware rules/categories/types (fb/ig/li)", old_4, new_4, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
