import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys, messages: [{ role: 'user', content: contentBlocks }] })"""
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"
NEW = """      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4096, system: sys, messages: [{ role: 'user', content: contentBlocks }] })"""
content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: max_tokens generate-ai-context 1500 -> 4096")
