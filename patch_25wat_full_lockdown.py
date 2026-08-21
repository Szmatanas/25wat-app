import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """async function getProjectBrandContext(projectId) {
  if (!projectId) return null;
  try {"""
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"

NEW = """async function getProjectBrandContext(projectId) {
  if (!projectId) return null;
  if (Number(projectId) === LEGACY_25WAT_PROJECT_ID) return null;
  try {"""

content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: 25wat (id=1) ma teraz twardy wyjatek rowniez w getProjectBrandContext")
