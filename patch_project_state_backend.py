import io

PATH = "server.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_assets (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      filename TEXT,
      mime_type TEXT,
      file_data BYTEA,
      text_content TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log('DB schema ready');
}"""

ANCHOR_PROJECTS_LIST_END = """app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, pm.role FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = $1
       ORDER BY p.created_at ASC`,
      [req.userId]
    );
    res.json({ projects: result.rows });
  } catch (e) {
    console.error('list projects:', e.message);
    res.status(500).json({ error: e.message });
  }
});"""

assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"
assert content.count(ANCHOR_PROJECTS_LIST_END) == 1, f"ANCHOR_PROJECTS_LIST_END count = {content.count(ANCHOR_PROJECTS_LIST_END)}"

NEW_SCHEMA = """  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_assets (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      filename TEXT,
      mime_type TEXT,
      file_data BYTEA,
      text_content TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_state (
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (project_id, key)
    );
  `);
  console.log('DB schema ready');
}

async function requireProjectMember(req, res, next) {
  const projectId = parseInt(req.params.projectId, 10);
  if (!projectId) return res.status(400).json({ error: 'Nieprawidlowy projectId' });
  try {
    const result = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    if (!result.rows.length) return res.status(403).json({ error: 'Brak dostepu do tego projektu' });
    req.projectId = projectId;
    req.projectRole = result.rows[0].role;
    next();
  } catch (e) {
    console.error('requireProjectMember:', e.message);
    res.status(500).json({ error: e.message });
  }
}"""

NEW_PROJECTS_LIST_END = """app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, pm.role FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = $1
       ORDER BY p.created_at ASC`,
      [req.userId]
    );
    res.json({ projects: result.rows });
  } catch (e) {
    console.error('list projects:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects/:projectId/state', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT key, value FROM project_state WHERE project_id = $1',
      [req.projectId]
    );
    const state = {};
    result.rows.forEach(row => { state[row.key] = row.value; });
    res.json({ state });
  } catch (e) {
    console.error('get project state:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/projects/:projectId/state/:key', requireAuth, requireProjectMember, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'Brak value' });
  try {
    await pool.query(
      `INSERT INTO project_state (project_id, key, value, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (project_id, key) DO UPDATE SET value = $3, updated_at = now()`,
      [req.projectId, key, JSON.stringify(value)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('put project state:', e.message);
    res.status(500).json({ error: e.message });
  }
});"""

content = content.replace(ANCHOR, NEW_SCHEMA, 1)
content = content.replace(ANCHOR_PROJECTS_LIST_END, NEW_PROJECTS_LIST_END, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: dodano project_state (tabela + GET/PUT + requireProjectMember)")
