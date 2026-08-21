import io

PATH = "server.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR_IMPORTS = "import { fileURLToPath } from 'url';\n"
ANCHOR_STATIC = "app.use('/assets', express.static(path.join(__dirname, 'assets')));\n"

assert content.count(ANCHOR_IMPORTS) == 1, f"ANCHOR_IMPORTS count = {content.count(ANCHOR_IMPORTS)}"
assert content.count(ANCHOR_STATIC) == 1, f"ANCHOR_STATIC count = {content.count(ANCHOR_STATIC)}"

NEW_IMPORTS = """import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
"""

AUTH_BLOCK = '''
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (project_id, user_id)
    );
  `);
  await pool.query(`
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
}
initDb().catch(e => console.error('initDb error:', e.message));

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Brak tokenu' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Nieprawidlowy lub wygasly token' });
  }
}

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Brak email/hasla' });
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'Ten email jest juz zarejestrowany' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email.toLowerCase(), hash, name || null]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    console.error('signup:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Brak email/hasla' });
  try {
    const result = await pool.query('SELECT id, email, name, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Nieprawidlowy email lub haslo' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Nieprawidlowy email lub haslo' });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    console.error('login:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Uzytkownik nie istnieje' });
    const projectsResult = await pool.query(
      `SELECT p.id, p.name, pm.role FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = $1
       ORDER BY p.created_at ASC`,
      [req.userId]
    );
    res.json({ user, projects: projectsResult.rows });
  } catch (e) {
    console.error('me:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Brak nazwy projektu' });
  try {
    const projectResult = await pool.query(
      'INSERT INTO projects (name, created_by) VALUES ($1, $2) RETURNING id, name',
      [name, req.userId]
    );
    const project = projectResult.rows[0];
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, req.userId, 'owner']
    );
    res.json({ project });
  } catch (e) {
    console.error('create project:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects', requireAuth, async (req, res) => {
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
'''

content = content.replace(ANCHOR_IMPORTS, ANCHOR_IMPORTS + NEW_IMPORTS, 1)
content = content.replace(ANCHOR_STATIC, ANCHOR_STATIC + AUTH_BLOCK, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: dodano auth + db schema")
