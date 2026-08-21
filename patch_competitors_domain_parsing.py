import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR1 = """      if (text) {
        return text.split('\\n').map(l => l.replace(/^[-*]\\s*/, '').trim()).filter(l => l.length > 0).map(name => ({ name, query: name + ' social media content 2026' }));
      }"""
assert content.count(ANCHOR1) == 1, f"ANCHOR1 count = {content.count(ANCHOR1)}"

NEW1 = """      if (text) {
        return text.split('\\n').map(l => l.replace(/^[-*]\\s*/, '').trim()).filter(l => l.length > 0).map(line => {
          const parts = line.split('|').map(p => p.trim());
          const name = parts[0] || line;
          const url = parts[1] || '';
          let domain = '';
          if (url) {
            try { domain = new URL(/^https?:\\/\\//.test(url) ? url : ('https://' + url)).hostname.replace(/^www\\./, ''); } catch (e) {}
          }
          return { name, query: name + ' social media content 2026', domains: domain ? [domain, 'linkedin.com'] : undefined };
        });
      }"""

content = content.replace(ANCHOR1, NEW1, 1)

ANCHOR2 = "const { text: ctx, sources } = await tavilySearchFull(c.query, COMPETITOR_DOMAINS);"
assert content.count(ANCHOR2) == 1, f"ANCHOR2 count = {content.count(ANCHOR2)}"
NEW2 = "const { text: ctx, sources } = await tavilySearchFull(c.query, c.domains || COMPETITOR_DOMAINS);"
content = content.replace(ANCHOR2, NEW2, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: getProjectCompetitors parsuje 'Nazwa | URL', Tavily przeszukuje domene firmy + linkedin")
