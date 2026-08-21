import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """app.get('/api/projects/:projectId/color-pairs', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const designAssets = await getProjectDesignAssets(req.projectId);
    res.json({ colorPairs: (designAssets && designAssets.colorPairs) ? designAssets.colorPairs : null });"""
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"
NEW = """app.get('/api/projects/:projectId/color-pairs', requireAuth, requireProjectMember, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const designAssets = await getProjectDesignAssets(req.projectId);
    res.json({ colorPairs: (designAssets && designAssets.colorPairs) ? designAssets.colorPairs : null });"""
content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: /color-pairs ma Cache-Control: no-store")
