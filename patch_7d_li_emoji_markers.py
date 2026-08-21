import io, sys

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

old = """        rules: `ZASADY FORMATU LI:
- Pierwsze zdanie to HOOK ekspercki - obserwacja, dana lub teza branzowa, max 15 slow
- Ton biznesowy, ekspercki, bez emoji-dekoracji (max 0-2 emoji, subtelnie)
- Struktura: teza/obserwacja -> konkretny przyklad lub doswiadczenie -> wniosek
- Ostatnie zdanie to zaproszenie do dyskusji branzowej (pytanie do innych profesjonalistow)
- Dlugosc: 200-350 slow (LinkedIn = thought leadership, dluzsza forma OK)`,"""

new = """        rules: `ZASADY FORMATU LI:
- Pierwsze zdanie to HOOK ekspercki - obserwacja, dana lub teza branzowa, max 15 slow
- Ton biznesowy, ekspercki. Emoji TYLKO jako wskaznik pojedynczej kluczowej linii (np. przed CTA/pytaniem, lokalizacja, data) - max 2-3 takie akcenty, nigdy jako dekoracja calego tekstu czy zamiennik punktorow
- Struktura: teza/obserwacja -> konkretny przyklad lub doswiadczenie -> wniosek
- Ostatnie zdanie to zaproszenie do dyskusji branzowej (pytanie do innych profesjonalistow)
- Dlugosc: 200-350 slow (LinkedIn = thought leadership, dluzsza forma OK)`,"""

count = content.count(old)
if count != 1:
    print(f"[FAIL] li.rules update: znaleziono {count}x (oczekiwano 1x)")
    sys.exit(1)
content = content.replace(old, new, 1)
with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] li.rules: emoji jako wskaznik kluczowej linii (nie dekoracja)")
