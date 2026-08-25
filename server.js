import fs from 'fs';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { put } from '@vercel/blob';
import { Document, Packer, Paragraph, HeadingLevel, ImageRun, PageBreak } from 'docx';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { imageSize } from 'image-size';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors({
  origin: ['https://aisomeboost.vercel.app', 'https://aisomeboost.netlify.app', 'http://localhost:3000', 'http://localhost:5500'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: false
}));
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const archiver = require('archiver');

function stripEmoji(s) {
  return (s || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

const AI_BADGE_FILES = { ai: 'badge-ai.png', ai_generated: 'badge-ai-generated.png', ai_modified: 'badge-ai-modified.png' };

async function applyAiBadge(buf, variant) {
  try {
    if (!variant || !AI_BADGE_FILES[variant]) return buf;
    const img = sharp(buf);
    const meta = await img.metadata();
    const w = meta.width || 800;
    const h = meta.height || 800;
    const badgeWidth = Math.max(40, Math.round(w * 0.09));
    const margin = Math.max(6, Math.round(w * 0.022));
    const badgePath = path.join(__dirname, 'assets', 'badges', AI_BADGE_FILES[variant]);
    const badgeBuf = await sharp(badgePath).resize({ width: badgeWidth }).toBuffer();
    const badgeMeta = await sharp(badgeBuf).metadata();
    const badgeHeight = badgeMeta.height || badgeWidth;
    return await img.composite([{ input: badgeBuf, left: w - badgeWidth - margin, top: h - badgeHeight - margin }]).toBuffer();
  } catch (e) {
    console.error('applyAiBadge:', e.message);
    return buf;
  }
}

async function fetchImageBuffer(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch (e) {
    console.error('fetchImageBuffer:', e.message);
    return null;
  }
}

async function uploadImageToBlob(b64, ext) {
  const buf = Buffer.from(b64, 'base64');
  const filename = 'designs/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const { url } = await put(filename, buf, {
    access: 'public',
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
    addRandomSuffix: false
  });
  return url;
}
const { parseOffice } = require('officeparser');
app.use(express.json({ limit: '30mb' }));
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Plik za duzy. Maksymalny rozmiar pliku to 20MB.' });
  }
  next(err);
});
app.use('/assets', express.static(path.join(__dirname, 'assets')));

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_state (
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (project_id, key)
    );
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_projects INTEGER;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_use_own_openai_key BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS openai_api_key TEXT;`);
  console.log('DB schema ready');
}

async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (!result.rows.length || result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Wymagane uprawnienia administratora' });
    }
    next();
  } catch (e) {
    console.error('requireAdmin:', e.message);
    res.status(500).json({ error: e.message });
  }
}

async function requireProjectOwnerOrAdmin(req, res, next) {
  try {
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    const isGlobalAdmin = userResult.rows.length && userResult.rows[0].role === 'admin';
    if (isGlobalAdmin) return next();
    if (req.projectRole === 'owner') return next();
    return res.status(403).json({ error: 'Tylko wlasciciel projektu lub administrator' });
  } catch (e) {
    console.error('requireProjectOwnerOrAdmin:', e.message);
    res.status(500).json({ error: e.message });
  }
}

async function requireProjectSettingsAccess(req, res, next) {
  try {
    const userResult = await pool.query('SELECT role, can_use_own_openai_key FROM users WHERE id = $1', [req.userId]);
    const u = userResult.rows[0];
    const isGlobalAdmin = u && u.role === 'admin';
    if (isGlobalAdmin) return next();
    if (req.projectRole === 'owner') return next();
    if (u && u.can_use_own_openai_key) return next();
    return res.status(403).json({ error: 'Brak dostepu do ustawien projektu' });
  } catch (e) {
    console.error('requireProjectSettingsAccess:', e.message);
    res.status(500).json({ error: e.message });
  }
}

async function getOpenAiKey(projectId) {
  if (projectId) {
    try {
      const r = await pool.query('SELECT openai_api_key FROM projects WHERE id = $1', [projectId]);
      const key = r.rows[0] && r.rows[0].openai_api_key;
      if (key) return key;
    } catch (e) {
      console.error('getOpenAiKey:', e.message);
    }
  }
  return process.env.OPENAI_KEY;
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
    const activeResult = await pool.query('SELECT is_active FROM users WHERE id = $1', [req.userId]);
    if (!activeResult.rows.length || activeResult.rows[0].is_active === false) {
      return res.status(403).json({ error: 'To konto zostalo dezaktywowane' });
    }
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
    const result = await pool.query('SELECT id, email, name, password_hash, role, is_active FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Nieprawidlowy email lub haslo' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Nieprawidlowy email lub haslo' });
    if (!user.is_active) return res.status(403).json({ error: 'To konto zostalo dezaktywowane. Skontaktuj sie z administratorem.' });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    console.error('login:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, email, name, role, max_projects, can_use_own_openai_key FROM users WHERE id = $1', [req.userId]);
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
    const userResult = await pool.query('SELECT role, max_projects FROM users WHERE id = $1', [req.userId]);
    const currentUser = userResult.rows[0];
    if (currentUser && currentUser.role !== 'admin' && currentUser.max_projects != null) {
      const countResult = await pool.query('SELECT COUNT(*) FROM project_members WHERE user_id = $1', [req.userId]);
      const currentCount = parseInt(countResult.rows[0].count, 10);
      if (currentCount >= currentUser.max_projects) {
        return res.status(403).json({ error: `Osiagnieto limit projektow (${currentUser.max_projects}). Popros administratora o zwiekszenie limitu.` });
      }
    }
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

// --- Admin: zarzadzanie userami (rola, limit projektow) ---
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.max_projects, u.can_use_own_openai_key, u.is_active,
              (SELECT COUNT(*) FROM project_members pm WHERE pm.user_id = u.id) AS project_count
       FROM users u ORDER BY u.created_at ASC`
    );
    res.json({ users: result.rows });
  } catch (e) {
    console.error('admin list users:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, name, role, maxProjects, canUseOwnKey } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Brak email/hasla' });
  if (password.length < 6) return res.status(400).json({ error: 'Haslo musi miec co najmniej 6 znakow' });
  if (role && role !== 'admin' && role !== 'member') return res.status(400).json({ error: 'Nieprawidlowa rola' });
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'Ten email jest juz zarejestrowany' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, role, max_projects, can_use_own_openai_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, max_projects, can_use_own_openai_key',
      [email.toLowerCase(), hash, name || null, role || 'member', maxProjects === undefined || maxProjects === null || maxProjects === '' ? null : parseInt(maxProjects, 10), !!canUseOwnKey]
    );
    res.json({ user: result.rows[0] });
  } catch (e) {
    console.error('admin create user:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/admin/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { role, maxProjects, canUseOwnKey, isActive } = req.body;
  if (!userId) return res.status(400).json({ error: 'Nieprawidlowy userId' });
  if (role && role !== 'admin' && role !== 'member') return res.status(400).json({ error: 'Nieprawidlowa rola' });
  if (isActive === false && userId === req.userId) return res.status(400).json({ error: 'Nie mozesz dezaktywowac wlasnego konta' });
  try {
    if (isActive === false && role !== 'member') {
      const targetRoleResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (targetRoleResult.rows[0] && targetRoleResult.rows[0].role === 'admin') {
        const adminCountResult = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = true`);
        if (parseInt(adminCountResult.rows[0].count, 10) <= 1) {
          return res.status(400).json({ error: 'Nie mozna dezaktywowac jedynego aktywnego administratora' });
        }
      }
    }
    const fields = [];
    const values = [];
    let i = 1;
    if (role) { fields.push(`role = $${i++}`); values.push(role); }
    if (maxProjects !== undefined) { fields.push(`max_projects = $${i++}`); values.push(maxProjects === null ? null : parseInt(maxProjects, 10)); }
    if (canUseOwnKey !== undefined) { fields.push(`can_use_own_openai_key = $${i++}`); values.push(!!canUseOwnKey); }
    if (isActive !== undefined) { fields.push(`is_active = $${i++}`); values.push(!!isActive); }
    if (!fields.length) return res.status(400).json({ error: 'Brak pol do aktualizacji' });
    values.push(userId);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, email, name, role, max_projects, can_use_own_openai_key, is_active`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Uzytkownik nie istnieje' });
    res.json({ user: result.rows[0] });
  } catch (e) {
    console.error('admin update user:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (!userId) return res.status(400).json({ error: 'Nieprawidlowy userId' });
  if (userId === req.userId) return res.status(400).json({ error: 'Nie mozesz usunac wlasnego konta' });
  try {
    const targetResult = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (!targetResult.rows.length) return res.status(404).json({ error: 'Uzytkownik nie istnieje' });
    if (targetResult.rows[0].role === 'admin') {
      const adminCountResult = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'admin'`);
      if (parseInt(adminCountResult.rows[0].count, 10) <= 1) {
        return res.status(400).json({ error: 'Nie mozna usunac jedynego administratora' });
      }
    }
    await pool.query('UPDATE projects SET created_by = NULL WHERE created_by = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('admin delete user:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// --- Czlonkowie projektu ---
app.get('/api/projects/:projectId/members', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, pm.role FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 ORDER BY pm.created_at ASC`,
      [req.projectId]
    );
    res.json({ members: result.rows });
  } catch (e) {
    console.error('list members:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:projectId/members', requireAuth, requireProjectMember, requireProjectOwnerOrAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Brak email' });
  try {
    const userResult = await pool.query('SELECT id, role, max_projects FROM users WHERE email = $1', [email.toLowerCase()]);
    const targetUser = userResult.rows[0];
    if (!targetUser) return res.status(404).json({ error: 'Nie znaleziono uzytkownika o tym emailu (musi miec juz konto)' });
    if (targetUser.role !== 'admin' && targetUser.max_projects != null) {
      const countResult = await pool.query('SELECT COUNT(*) FROM project_members WHERE user_id = $1', [targetUser.id]);
      const currentCount = parseInt(countResult.rows[0].count, 10);
      if (currentCount >= targetUser.max_projects) {
        return res.status(403).json({ error: `Ten uzytkownik osiagnal limit projektow (${targetUser.max_projects})` });
      }
    }
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO NOTHING',
      [req.projectId, targetUser.id, 'member']
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('add member:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/projects/:projectId/members/:userId', requireAuth, requireProjectMember, requireProjectOwnerOrAdmin, async (req, res) => {
  const targetUserId = parseInt(req.params.userId, 10);
  try {
    const ownerCountResult = await pool.query(
      `SELECT COUNT(*) FROM project_members WHERE project_id = $1 AND role = 'owner'`,
      [req.projectId]
    );
    const targetRoleResult = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.projectId, targetUserId]
    );
    const targetRole = targetRoleResult.rows[0] && targetRoleResult.rows[0].role;
    if (targetRole === 'owner' && parseInt(ownerCountResult.rows[0].count, 10) <= 1) {
      return res.status(400).json({ error: 'Nie mozna usunac jedynego wlasciciela projektu' });
    }
    await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [req.projectId, targetUserId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('remove member:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// --- Ustawienia projektu: klucz OpenAI klienta ---
app.get('/api/projects/:projectId/settings', requireAuth, requireProjectMember, requireProjectSettingsAccess, async (req, res) => {
  try {
    const result = await pool.query('SELECT openai_api_key FROM projects WHERE id = $1', [req.projectId]);
    const key = result.rows[0] && result.rows[0].openai_api_key;
    const masked = key ? key.slice(0, 3) + '...' + key.slice(-4) : null;
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    const isGlobalAdmin = userResult.rows.length && userResult.rows[0].role === 'admin';
    const canManageMembers = isGlobalAdmin || req.projectRole === 'owner';
    res.json({ hasOpenAiKey: !!key, maskedKey: masked, canManageMembers });
  } catch (e) {
    console.error('get project settings:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/projects/:projectId/settings', requireAuth, requireProjectMember, requireProjectSettingsAccess, async (req, res) => {
  const { openaiApiKey } = req.body;
  try {
    await pool.query('UPDATE projects SET openai_api_key = $1 WHERE id = $2', [openaiApiKey || null, req.projectId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('update project settings:', e.message);
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
});

app.get('/api/projects/:projectId/assets', requireAuth, requireProjectMember, async (req, res) => {
  const { category } = req.query;
  try {
    const params = [req.projectId];
    let sql = 'SELECT id, category, filename, mime_type, text_content, metadata, created_at FROM brand_assets WHERE project_id = $1';
    if (category) { params.push(category); sql += ' AND category = $2'; }
    sql += ' ORDER BY created_at DESC';
    const result = await pool.query(sql, params);
    res.json({ assets: result.rows });
  } catch (e) {
    console.error('list assets:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const TEXT_CATEGORIES = ['ai_context', 'ai_context_rules', 'brand_context', 'tone_of_voice', 'trends_focus', 'competitors', 'brandbook'];

app.post('/api/projects/:projectId/assets', requireAuth, requireProjectMember, async (req, res) => {
  const { category, filename, mimeType, fileBase64, textContent, metadata } = req.body;
  if (!category) return res.status(400).json({ error: 'Brak category' });
  try {
    let fileBuffer = null;
    let finalTextContent = textContent || null;
    if (fileBase64) {
      const b64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      fileBuffer = Buffer.from(b64, 'base64');
    }
    if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType === 'application/pdf') {
      try {
        const parser = new PDFParse({ data: fileBuffer });
        const parsed = await parser.getText();
        await parser.destroy();
        finalTextContent = (parsed.text || '').trim().slice(0, 50000);
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tekstu z PDF (moze to skan bez warstwy tekstowej).' });
        }
        fileBuffer = null;
      } catch (pdfErr) {
        console.error('pdf-parse:', pdfErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc PDF: ' + pdfErr.message });
      }
    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      try {
        const ast = await parseOffice(fileBuffer, { fileType: 'pptx' });
        finalTextContent = (ast.toText() || '').trim().slice(0, 50000);
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tekstu z prezentacji PowerPoint.' });
        }
        fileBuffer = null;
      } catch (pptErr) {
        console.error('officeparser pptx:', pptErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc pliku PowerPoint: ' + pptErr.message });
      }
    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType.startsWith('image/')) {
      try {
        const visionSys = 'Jestes asystentem ktory czyta zdjecia/skany dokumentow marketingowych (brand book, strategia, tone of voice, przyklady kolorow) i wypisuje z nich caly istotny tekst oraz opis wizualny (kolory - podaj dokladne kody HEX jesli da sie je odczytac lub oszacowac, fonty, styl) w czystym tekscie po polsku. Nie dodawaj wlasnych komentarzy ani ocen - tylko fakty z obrazu.';
        const visionRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: visionSys,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBuffer.toString('base64') } },
              { type: 'text', text: 'Wypisz cala tresc i opis wizualny (w tym szacowane kody HEX kolorow) tego obrazu.' }
            ] }]
          })
        });
        const visionData = await visionRes.json();
        finalTextContent = ((visionData.content || []).find(b => b.type === 'text') || {}).text || '';
        if (!finalTextContent) {
          return res.status(400).json({ error: 'Nie udalo sie odczytac tresci z obrazu.' });
        }
        fileBuffer = null;
      } catch (visErr) {
        console.error('vision-extract:', visErr.message);
        return res.status(400).json({ error: 'Nie udalo sie przetworzyc obrazu: ' + visErr.message });
      }
    } else if (fileBuffer && TEXT_CATEGORIES.includes(category) && mimeType && mimeType !== 'text/plain' && mimeType !== 'text/markdown' && !mimeType.startsWith('text/')) {
      return res.status(400).json({ error: 'Ten kafelek przyjmuje tekst (.txt, .md), PDF, PowerPoint (.pptx) lub obraz (PNG/JPG).' });
    }
    const SINGLETON_CATEGORIES = ['ai_context', 'ai_context_rules'];
    if (SINGLETON_CATEGORIES.includes(category)) {
      await pool.query('DELETE FROM brand_assets WHERE project_id = $1 AND category = $2', [req.projectId, category]);
    }
    const result = await pool.query(
      `INSERT INTO brand_assets (project_id, category, filename, mime_type, file_data, text_content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category, filename, mime_type, text_content, metadata, created_at`,
      [req.projectId, category, filename || null, mimeType || null, fileBuffer, finalTextContent, JSON.stringify(metadata || {})]
    );
    res.json({ asset: result.rows[0] });
  } catch (e) {
    console.error('upload asset:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects/:projectId/assets/:assetId/file', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_data, mime_type, filename FROM brand_assets WHERE id = $1 AND project_id = $2',
      [req.params.assetId, req.projectId]
    );
    const row = result.rows[0];
    if (!row || !row.file_data) return res.status(404).json({ error: 'Plik nie znaleziony' });
    res.set('Content-Type', row.mime_type || 'application/octet-stream');
    res.send(row.file_data);
  } catch (e) {
    console.error('get asset file:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/projects/:projectId/assets/:assetId', requireAuth, requireProjectMember, async (req, res) => {
  try {
    await pool.query('DELETE FROM brand_assets WHERE id = $1 AND project_id = $2', [req.params.assetId, req.projectId]);
    res.json({ ok: true });
  } catch (e) {
    console.error('delete asset:', e.message);
    res.status(500).json({ error: e.message });
  }
});
const TAVILY_KEY = process.env.TAVILY_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';
const REMOVE_BG_KEY = process.env.REMOVEBG_API_KEY || '';
const COMPETITORS = [
  { name: 'Sellwise', query: 'Sellwise Szymon Negacz social media content 2026' },
  { name: 'Automation House', query: 'Automation House agencja AI Polska content 2026' },
  { name: 'W Praktyce AI', query: 'W Praktyce AI automatyzacja Polska content 2026' },
  { name: 'Agenci.ai', query: 'Agenci.ai Polska social media content 2026' },
];
async function tavilySearchFull(query, domains) {
  const body = { api_key: TAVILY_KEY, query, search_depth: 'basic', max_results: 4 };
  if (Array.isArray(domains) && domains.length) body.include_domains = domains;
  const res = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Tavily ' + res.status);
  const data = await res.json();
  const text = data.results.map(r => '[' + r.title + ']\n' + r.content).join('\n\n---\n\n');
  const sources = data.results.slice(0, 3).map(r => ({ title: r.title, url: r.url }));
  return { text, sources };
}
async function tavilySearch(query, domains) {
  const r = await tavilySearchFull(query, domains);
  return r.text;
}
const TREND_PORTALS = ['bankier.pl','antyweb.pl','spidersweb.pl','wirtualnemedia.pl','socialpress.pl','nowymarketing.pl','businessinsider.com.pl'];
const COMPETITOR_DOMAINS = ['linkedin.com'];
function safeJSON(raw) {
  try { return JSON.parse(raw.replace(/```json|```/g,'').replace(/[\u2013\u2014]/g,'-').replace(/[\u201c\u201d\u201e\u201f]/g,'"').replace(/[\u2018\u2019]/g,"'").trim()); }
  catch(e) { console.error('JSON err:',e.message); return {}; }
}
async function claude(system, context) {
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, system, messages: [{ role: 'user', content: 'Dane:\n' + context + '\n\nOdpowiedz TYLKO JSON po polsku. Bez em-dash, bez typograficznych cudzyslowow.' }] }) });
  if (!res.ok) { const e = await res.text(); throw new Error('Claude ' + res.status + ': ' + e); }
  const data = await res.json();
  return safeJSON(data.content.find(b => b.type === 'text')?.text || '{}');
}
async function removeBg(buf) {
  const form = new FormData();
  form.append('image_file', new Blob([buf]), 'photo.png');
  form.append('size', 'auto');
  const r = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': REMOVE_BG_KEY },
    body: form
  });
  if (!r.ok) { const e = await r.text(); throw new Error('remove.bg ' + r.status + ': ' + e); }
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

app.get('/', (req, res) => res.json({ status: 'ok' }));
app.post('/api/research', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Brak query' });
  try {
    const ctx = await tavilySearch(query + ' agencja AI Polska 2026');
    const sys = 'Jestes analitykiem w 25wat. Analizujesz: ' + query + '. Odpowiedz TYLKO JSON po polsku: {"summary":"max 2 zdania","threat_level":"low|medium|high","action":"max 1 zdanie"}';
    res.json({ analysis: await claude(sys, ctx) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/research/auto', async (req, res) => {
  const { projectId } = req.body || {};
  try {
    const results = [];
    const now = new Date();
    const monthsPl = ['styczen','luty','marzec','kwiecien','maj','czerwiec','lipiec','sierpien','wrzesien','pazdziernik','listopad','grudzien'];
    const dateLabel = monthsPl[now.getMonth()] + ' ' + now.getFullYear();
    const activeCompetitors = await getProjectCompetitors(projectId);
    if (!activeCompetitors.length) {
      results.push({ type: 'competitors_missing', checkedAt: dateLabel });
    } else {
      const comp = await Promise.allSettled(activeCompetitors.map(async (c) => {
        const { text: ctx, sources } = await tavilySearchFull(c.query, c.domains || COMPETITOR_DOMAINS);
        if (!ctx || ctx.trim().length < 30) {
          return { name: c.name, analysis: { message: null, topic: null, opportunity: null, threat_level: 'low', noData: true }, sources: [], checkedAt: dateLabel };
        }
        const sys = 'Jestes analitykiem opisujacym konkurencje. Opisz krotko co konkurent "' + c.name + '" komunikuje teraz. Odpowiedz TYLKO JSON po polsku, max 10 slow na pole, bez em-dash: {"message":"co promuje/komunikuje teraz - max 10 slow","topic":"temat - max 4 slowa","opportunity":"szansa dla klienta - max 8 slow","threat_level":"low|medium|high"}';
        return { name: c.name, analysis: await claude(sys, ctx), sources, checkedAt: dateLabel };
      }));
      comp.forEach(r => { if (r.status === 'fulfilled') results.push({ type: 'competitor', ...r.value }); });
    }
    const activeTrendsFocus = await getProjectTrendsFocus(projectId);
    if (!activeTrendsFocus) {
      results.push({ type: 'trends_missing', checkedAt: dateLabel });
    } else {
      try {
        const trendsQuery = activeTrendsFocus.slice(0, 200);
        const { text: tCtx, sources: trendSources } = await tavilySearchFull(trendsQuery + ' ' + dateLabel, TREND_PORTALS);
        const tSys = 'Jestes analitykiem content. Trendy: ' + trendsQuery + ' teraz. Odpowiedz TYLKO JSON po polsku, bez em-dash: {"hot_topics":["temat 1 - max 8 slow","temat 2","temat 3","temat 4"],"content_angles":["kat 1 - max 8 slow","kat 2","kat 3"],"action":"napisz post o: max 10 slow"}';
        results.push({ type: 'trends', name: 'Trendy', analysis: await claude(tSys, tCtx), sources: trendSources, checkedAt: dateLabel });
      } catch (e) {
        console.error('trends search failed:', e.message);
        results.push({ type: 'trends_error', name: 'Trendy', error: e.message, checkedAt: dateLabel });
      }
    }
    res.json({ results });
  } catch(e) { console.error(e.message); res.status(500).json({ error: e.message }); }
});

app.post('/api/projects/:projectId/export/word', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts) || !posts.length) return res.status(400).json({ error: 'Brak postow do eksportu' });
    const children = [];
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i] || {};
      const num = String(i + 1).padStart(2, '0');
      const chLabel = (p.channel || 'fb').toUpperCase();
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        text: num + ' — ' + chLabel + (p.title ? ' — ' + p.title : '')
      }));
      if (p.thumb) {
        let buf = await fetchImageBuffer(p.thumb);
        if (buf && p.aiLabelVariant) buf = await applyAiBadge(buf, p.aiLabelVariant);
        if (buf) {
          try {
            const dim = imageSize(buf);
            const maxW = 420;
            const scale = dim.width > maxW ? maxW / dim.width : 1;
            children.push(new Paragraph({
              children: [ new ImageRun({
                data: buf,
                transformation: { width: Math.round(dim.width * scale), height: Math.round(dim.height * scale) }
              }) ]
            }));
          } catch (e) { console.error('export/word image:', e.message); }
        }
      }
      const lines = (p.content || '').split('\n');
      for (const line of lines) {
        children.push(new Paragraph({ text: line }));
      }
      if (i < posts.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="25wat-eksport.docx"');
    res.send(buffer);
  } catch (e) {
    console.error('export/word:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:projectId/export/pdf', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts) || !posts.length) return res.status(400).json({ error: 'Brak postow do eksportu' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="25wat-eksport.pdf"');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.registerFont('Gilroy', path.join(__dirname, 'assets/fonts/Gilroy-Regular.otf'));
    doc.registerFont('Gilroy-Bold', path.join(__dirname, 'assets/fonts/Gilroy-SemiBold.otf'));
    doc.pipe(res);
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i] || {};
      const num = String(i + 1).padStart(2, '0');
      const chLabel = (p.channel || 'fb').toUpperCase();
      if (i > 0) doc.addPage();
      doc.font('Gilroy-Bold').fontSize(16).fillColor('#000000').text(num + ' — ' + chLabel + (p.title ? ' — ' + stripEmoji(p.title) : ''));
      doc.moveDown(0.5);
      if (p.thumb) {
        let buf = await fetchImageBuffer(p.thumb);
        if (buf && p.aiLabelVariant) buf = await applyAiBadge(buf, p.aiLabelVariant);
        if (buf) {
          try {
            doc.image(buf, { fit: [500, 350] });
            doc.moveDown(0.5);
          } catch (e) { console.error('export/pdf image:', e.message); }
        }
      }
      doc.font('Gilroy').fontSize(11).fillColor('#333333').text(stripEmoji(p.content || ''));
    }
    doc.end();
  } catch (e) {
    console.error('export/pdf:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:projectId/export/zip', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts) || !posts.length) return res.status(400).json({ error: 'Brak postow do eksportu' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="25wat-eksport.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', function(err) { console.error('archiver error:', err.message); });
    archive.pipe(res);
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i] || {};
      const num = String(i + 1).padStart(2, '0');
      const chLabel = (p.channel || 'fb').toUpperCase();
      const safeTitle = (p.title || 'post').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'post';
      const folderName = num + '_' + chLabel + '_' + safeTitle;
      archive.append(p.content || '', { name: folderName + '/tekst.txt' });
      if (p.thumb) {
        try {
          const imgResp = await fetch(p.thumb);
          if (imgResp.ok) {
            let buf = Buffer.from(await imgResp.arrayBuffer());
            if (p.aiLabelVariant) buf = await applyAiBadge(buf, p.aiLabelVariant);
            const ext = /\.jpe?g(\?|$)/i.test(p.thumb) ? 'jpg' : 'png';
            archive.append(buf, { name: folderName + '/grafika.' + ext });
          }
        } catch (e) { console.error('export/zip image fetch:', e.message); }
      }
    }
    await archive.finalize();
  } catch (e) {
    console.error('export/zip:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

app.post('/api/design/upload-photo', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Brak imageBase64' });
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(imageBase64);
    if (!match) return res.status(400).json({ error: 'Nieprawidlowy format obrazu (oczekiwano data:image/png|jpeg;base64,...)' });
    const ext = match[1] === 'jpg' ? 'jpeg' : match[1];
    const url = await uploadImageToBlob(match[2], ext);
    res.json({ url });
  } catch(e) {
    console.error('upload-photo:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/design/generate-photo', async (req, res) => {
  const { postTitle, projectId } = req.body;
  const hasDescription = !!(postTitle && postTitle.trim().length > 0);
  const prompt = hasDescription
    ? `Photorealistic editorial image, natural soft daylight, clean neutral background suitable for knockout, calm confident mood, no filters, no stock-photo vibe, 4:5 aspect ratio. Follow this description closely for the subject's appearance, setting and activity - the subject may be a person, an object, an animal, a creature, a mascot or anything else described below. Do not force a human figure, generic office attire or any specific ethnicity/appearance unless the description itself explicitly calls for it: ${postTitle}.`
    : `Candid editorial portrait of a confident person in their 30s, wearing a strong-colored shirt (orange, green or grey), sitting at a laptop in a real modern office, making eye contact, natural soft daylight, clean neutral background suitable for knockout, calm professional mood, no filters, no stock-photo vibe, photorealistic, 4:5 aspect ratio. Vary the person's ethnicity and appearance naturally and diversely across generations - do not default to any single ethnicity or appearance every time.`;
  try {
    const OPENAI_KEY = await getOpenAiKey(projectId);
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENAI_KEY
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1536',
        quality: 'high'
      })
    });
    const data = await r.json();
    if (data.data?.[0]?.b64_json) {
      const url = await uploadImageToBlob(data.data[0].b64_json, 'png');
      res.json({ url });
    } else {
      throw new Error(data.error?.message || 'Brak obrazu w odpowiedzi');
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Design generation: pary kolorow (na sztywno, z rules.md) ──
const COLOR_PAIRS = [
  { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accentColor: '#7648F8', accentName: 'ultraviolet', doodleColor: '#D0F200', doodleName: 'neon', accentType: 'flubber' },
  { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accentColor: '#D0F200', accentName: 'neon', doodleColor: '#7648F8', doodleName: 'ultraviolet', accentType: 'flubber' },
  { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accentColor: '#D0F200', accentName: 'neon', doodleColor: '#7648F8', doodleName: 'ultraviolet', accentType: 'flubber' },
  { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accentColor: '#7648F8', accentName: 'ultraviolet', doodleColor: '#D0F200', doodleName: 'neon', accentType: 'flubber' },
  { bg: '#D0F200', bgName: 'neon', text: '#171717', accentColor: null, accentName: null, doodleColor: '#171717', doodleName: 'dark', accentType: 'none' },
];
const DOODLE_TYPES = ['arrow-1','arrow-2','arrow-3','circles-1','circles-2','underlines-1','underlines-2','sparkles','x-mark'];
const FLUBBER_SHAPES = [1,2,3,4,5];
const FORMATS = {
  'post-1-1': { w: 1080, h: 1080, label: 'Feed 1:1' },
  'post-4-5': { w: 1080, h: 1350, label: 'Feed 4:5' },
  'story': { w: 1080, h: 1920, label: 'Story 9:16' },
};
const LAYOUTS_NO_PHOTO = ['top-heavy', 'center-split'];
const LAYOUTS_WITH_PHOTO = ['photo-bottom', 'photo-side'];
function pick(value, allowed, fallback) { return allowed.includes(value) ? value : fallback; }

const ZONES = ['corner-br','corner-tr','side-right','side-left','center'];
const ALIGNS = ['top','center','bottom'];
const ACCENT_SHAPES = ['flubber-1','flubber-2','flubber-3','flubber-4','flubber-5','asterisk','chevrons'];
const PHOTO_SHAPES_FLUBBER = ['flubber','circle','rounded-square'];
const PHOTO_SHAPES_NOFLUBBER = ['circle','rounded-square'];

app.post('/api/design/generate-brief', async (req, res) => {
  const { post, colorPairIdx, hasPhoto, format, previousZone, previousAccentShape, projectId } = req.body;
  if (!post || !post.content) return res.status(400).json({ error: 'Brak posta' });
  const pairIdx = Number.isInteger(colorPairIdx) && COLOR_PAIRS[colorPairIdx] ? colorPairIdx : 2;
  const pair = COLOR_PAIRS[pairIdx];
  const designAssets = await getProjectDesignAssets(projectId);
  if (projectId && Number(projectId) !== LEGACY_25WAT_PROJECT_ID) {
    const hasAnyBrandData = designAssets && (designAssets.colorPairs || designAssets.logoDataUrl || (designAssets.referenceImages && designAssets.referenceImages.length) || designAssets.aiContextText);
    if (!hasAnyBrandData) {
      return res.status(400).json({ error: 'Brak danych marki dla tego projektu (Brand Strategy / AI Context / Logo / przykladowe kompozycje). Uzupelnij Baze Wiedzy Marki przed generowaniem designu.' });
    }
  }
  const brandBg = (designAssets && designAssets.colorPairs && designAssets.colorPairs.length)
    ? designAssets.colorPairs[pairIdx % designAssets.colorPairs.length]
    : null;
  const fmt = FORMATS[format] ? format : 'post-4-5';
  const hasAccent = pair.accentType === 'flubber';
  const accentChoices = hasPhoto ? (hasAccent ? PHOTO_SHAPES_FLUBBER : PHOTO_SHAPES_NOFLUBBER) : (hasAccent ? ACCENT_SHAPES : ['none']);
  const variationNote = previousZone
    ? `\nWAZNE - REGENERACJA: poprzednio wybrales strefe "${previousZone}"${previousAccentShape ? ' i ksztalt "' + previousAccentShape + '"' : ''}. Tym razem wybierz WYRAZNIE INNA kombinacje - realna, widoczna zmiana.`
    : '';

  const sys = `Jestes Art Directorem w agencji 25wat. Projektujesz grafike social media na podstawie posta, scisle wg brand booku, z duza kreatywnoscia w kompozycji.

ZASADY (nieprzekraczalne):
- Headline max 8 slow, jedna fraza wyrozniona (heading-split).
- Marka jest flat - zero gradientow.
- Margines min. 80px.
- Doodle typy: ${DOODLE_TYPES.join(', ')}.
- Strefa kompozycji (gdzie trafia zdjecie/akcent, headline zajmuje reszte): ${ZONES.join(', ')}.
- Wyrownanie headline w swojej strefie: ${ALIGNS.join(', ')}.
- ${hasPhoto ? 'Ksztalt zdjecia: ' + accentChoices.join(', ') + '.' : (hasAccent ? 'Ksztalt akcentu: ' + accentChoices.join(', ') + ' (flubber-N to numer 1-5, lub geometryczny asterisk/chevrons).' : 'Ta para kolorow nie ma akcentu - ustaw accentShape na none.')}
- Dopasuj strefe i wyrownanie do nastroju i dlugosci headline.${variationNote}

Odpowiedz TYLKO JSON bez markdown:
{"headline":"max 8 slow po polsku","headlineHighlight":"fragment do wyroznienia (dokladny podciag)","doodleType":"jeden z: ${DOODLE_TYPES.join('|')}","zone":"jeden z: ${ZONES.join('|')}","align":"jeden z: ${ALIGNS.join('|')}","${hasPhoto ? 'photoShape' : 'accentShape'}":"jeden z: ${accentChoices.join('|')}"}`;

  try {
    const context = `Tytul posta: ${post.title || ''}\nTyp posta: ${post.type || ''}\nTresc posta: ${post.content}`;
    const raw = await claude(sys, context);
    const doodleType = pick(raw.doodleType, DOODLE_TYPES, 'underlines-1');
    let zone = pick(raw.zone, ZONES, ZONES[0]);
    const align = pick(raw.align, ALIGNS, 'top');
    let shapeChoice = pick(hasPhoto ? raw.photoShape : raw.accentShape, accentChoices, accentChoices[0]);

    if (previousZone && zone === previousZone && ZONES.length > 1) {
      zone = ZONES.find(z => z !== previousZone) || zone;
    }
    if (previousAccentShape && shapeChoice === previousAccentShape && accentChoices.length > 1) {
      shapeChoice = accentChoices.find(s => s !== previousAccentShape) || shapeChoice;
    }

    const headline = (raw.headline || post.title || '25wat').toString().slice(0, 120);
    const headlineHighlight = (raw.headlineHighlight || '').toString().slice(0, 60);
    const doodleFile = `doodle-${pair.doodleName}-${doodleType}.svg`;

    let accentFile = null;
    if (hasPhoto) {
      if (shapeChoice === 'flubber' && hasAccent) {
        const n = 1 + Math.floor(Math.random()*5);
        accentFile = `flubber-${pair.accentName}-${n}.svg`;
      }
    } else if (hasAccent && shapeChoice !== 'none') {
      if (shapeChoice.startsWith('flubber-')) {
        accentFile = `flubber-${pair.accentName}-${shapeChoice.split('-')[1]}.svg`;
      } else {
        accentFile = `graphic-element-${pair.accentName}-${shapeChoice}.svg`;
      }
    }
    const accentFolder = accentFile ? (accentFile.startsWith('flubber') ? 'flubber' : 'graphic-element') : null;

    res.json({
      format: fmt,
      dimensions: FORMATS[fmt],
      zone,
      align,
      accentShape: hasPhoto ? null : shapeChoice,
      photoShape: hasPhoto ? shapeChoice : null,
      background: brandBg ? brandBg.bg : pair.bg,
      textColor: brandBg ? brandBg.text : pair.text,
      accentColor: pair.accentColor,
      doodleColor: pair.doodleColor,
      headline,
      headlineHighlight,
      hasPhoto: !!hasPhoto,
      assets: {
        doodle: `/assets/graphic/doodle/${doodleFile}`,
        accent: accentFile ? `/assets/graphic/${accentFolder}/${accentFile}` : null,
        logo: (designAssets && designAssets.logoDataUrl) ? designAssets.logoDataUrl : (pair.bgName === 'dark' ? '/assets/logo/primary-logo-25wat-light.svg' : '/assets/logo/primary-logo-25wat-dark.svg'),
      }
    });
  } catch(e) {
    console.error(e.message);
    res.status(500).json({ error: e.message });
  }
});


const PHOTO_ARCHETYPES = {
  'text-left-photo-right': {
    prompt: 'LAYOUT: all text elements (headline, subheadline, stats, list items, CTA) must live entirely within a LEFT column occupying roughly the left 58% of the canvas width, full height, with generous margins. The RIGHT 42% of the canvas width, full height, must remain pure flat background color - absolutely no text, no letters, no shapes there. This right column is reserved for a photo cutout with an organic flubber blob accent shape behind it, to be composited afterward by another process. Treat the boundary between the two columns like the edge of the canvas.',
    region: (W, H) => ({ w: Math.round(W * 0.42), h: H - 160, left: W - Math.round(W * 0.42) - 40, top: 120 }),
    position: 'bottom'
  },
  'headline-top-photo-bottom': {
    prompt: 'LAYOUT: all text elements must fit ENTIRELY within the TOP 55% of the canvas height. The bottom 45% of the canvas, across its full width, must remain completely empty flat background color - absolutely no text, no letters, no doodles, no shapes may extend into this bottom band even partially. This bottom band is reserved for a real photograph to be composited afterward. Treat this bottom band exactly like the edge of the canvas.',
    region: (W, H) => ({ w: Math.round(W * 0.62), h: Math.round(H * 0.45) - 40, left: W - Math.round(W * 0.62) - 40, top: H - (Math.round(H * 0.45) - 40) - 40 }),
    position: 'bottom'
  },
  'photo-center-text-around': {
    prompt: 'LAYOUT: leave a rectangular area in the vertical middle of the canvas, roughly 50% of canvas width and 42% of canvas height, centered horizontally, completely empty flat background color - no text, no shapes there. Headline text goes above this area, supporting text or CTA goes below it. This central area is reserved for a photo cutout to be composited afterward.',
    region: (W, H) => ({ w: Math.round(W * 0.5), h: Math.round(H * 0.42), left: Math.round(W * 0.25), top: Math.round(H * 0.30) }),
    position: 'center'
  },
  'typography-hero-small-photo': {
    prompt: 'LAYOUT: huge bold typography dominates almost the entire canvas as the hero element. Leave one small square area, no larger than roughly 26% of canvas width, in the bottom-right corner completely empty flat background color - no text, no shapes there. This small area is reserved for a small circular or rounded-square photo cutout, a human accent, not the main focus.',
    region: (W, H) => { const s = Math.round(W * 0.26); return { w: s, h: s, left: W - s - 50, top: H - s - 50 }; },
    position: 'center'
  }
};
const ARCHETYPE_KEYS = Object.keys(PHOTO_ARCHETYPES);

app.post('/api/design/generate-image', async (req, res) => {
  const { post, colorPairIdx, userPhoto, photoDescription, hasPhoto, customHeadline, styleNote, format, projectId } = req.body;
  if (!post) return res.status(400).json({ error: 'Brak posta' });
  const OPENAI_KEY = await getOpenAiKey(projectId);
  if (!OPENAI_KEY) return res.status(500).json({ error: 'Brak OPENAI_KEY na serwerze' });

  const pairs = [
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#D0F200', bgName: 'neon', text: '#171717', accent: '#171717', accentName: 'dark' }
  ];
  const designAssets = await getProjectDesignAssets(projectId);
  if (projectId && Number(projectId) !== LEGACY_25WAT_PROJECT_ID) {
    const hasAnyBrandData = designAssets && (designAssets.colorPairs || designAssets.logoDataUrl || (designAssets.referenceImages && designAssets.referenceImages.length) || designAssets.aiContextText);
    if (!hasAnyBrandData) {
      return res.status(400).json({ error: 'Brak danych marki dla tego projektu (Brand Strategy / AI Context / Logo / przykladowe kompozycje). Uzupelnij Baze Wiedzy Marki przed generowaniem designu.' });
    }
  }
  const activePairs = (designAssets && designAssets.colorPairs && designAssets.colorPairs.length) ? designAssets.colorPairs : pairs;
  const pair = activePairs[colorPairIdx ?? 2] || activePairs[0];
  const wantsPhoto = hasPhoto !== false && !!userPhoto;

  const SIZE_MAP = { 'post-1-1': '1024x1024', 'post-4-5': '1024x1536', 'story': '1024x1536', 'landscape': '1536x1024' };
  const size = SIZE_MAP[format] || '1024x1536';

  const DARK_REFS = ['dark-post-4_5-example-4.png', 'dark-post-square-example-1.png', 'dark-post-square-example-2.png', 'dark-post-square-example-3.png'];
  const LIGHT_REFS = ['light-post-4_5-example-8.png', 'light-post-square-example-5.png', 'light-post-square-example-6.png', 'light-post-square-example-7.png'];
  const references = pair.bgName === 'dark' ? DARK_REFS : LIGHT_REFS;
  const usingCustomRefs = !!(designAssets && designAssets.referenceImages && designAssets.referenceImages.length);

  try {
    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/schemat/schemat.md');
    const schemaText = (designAssets && designAssets.aiContextText)
      ? ('KONTEKST MARKI I STYL WIZUALNY' + (designAssets.brandName ? ' (' + designAssets.brandName + ')' : '') + ':\n' + designAssets.aiContextText)
      : fs.readFileSync(schemaPath, 'utf8');
    const EXAMPLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/examples');

    const postText = `Tytul: ${post.title || ''}\n${post.content || ''}`;

    const colorInstruction = `UZYJ DOKLADNIE tej pary kolorow, nie wybieraj innej z tabeli w schemacie: tlo ${pair.bg} (${pair.bgName}), tekst ${pair.text}, akcent ${pair.accent} (${pair.accentName}).`;

    const headlineInstruction = customHeadline
      ? `Uzyj DOKLADNIE tego headline, nie zmieniaj tresci: "${customHeadline}"`
      : `Wyciagnij z posta krotki, konkretny headline (max 3 linie) - dokladnie o tym, o czym jest ten post, nie ogolnik o firmie.`;

    const photoInstruction = wantsPhoto ? `The LAST attached image is the real photo of the person featured in this post. This photo has higher priority than every other reference image attached below.

Treat this image as the primary visual anchor. Preserve the person's identity with the highest possible fidelity.

Do not change: facial structure, eyes, nose, mouth, hairstyle, facial hair, skin tone, age, expression, clothing, body proportions, pose, camera angle.

Do not reinterpret, beautify, stylize, redraw or replace the person. Do not generate a similar person. Use the supplied person exactly as the reference.

The person must be indistinguishable from the supplied photograph.

Build the entire composition around this photo. Modify only the surrounding graphic design: typography, colors, shapes, illustrations, background, layout.` : 'Ten post nie ma zdjecia - czysta kompozycja typograficzna z doodle/flubber zgodnie ze schematem, bez zdjecia i bez osoby.';

    const styleInstruction = styleNote ? `Uwaga stylistyczna od klienta, zastosuj ja: ${styleNote}` : '';

    const logoInstruction = (designAssets && designAssets.logoDataUrl)
      ? 'Jeden z dolaczonych obrazow to dokladne logo marki - umiesc je czytelnie w rogu kompozycji (tam gdzie nie koliduje z tekstem), zachowaj dokladny ksztalt i kolory logo, nie przerysowuj go ani nie zmieniaj.'
      : '';

    const prompt = `${wantsPhoto ? 'PRIORYTET: dolaczone zdjecie osoby jest najwazniejsze - patrz instrukcja o zdjeciu nizej.\n\n' : ''}${schemaText}\n\n---\n\n${colorInstruction}\n${headlineInstruction}\n\n${photoInstruction}\n${styleInstruction}\n${logoInstruction}\n\nTresc posta:\n${postText}\n\nPrzygotuj grafike zgodnie ze schematem, referencjami i powyzszymi instrukcjami.`;

    // Responses API + image_generation tool: model sam decyduje jak zbudowac obraz
    // na podstawie calego kontekstu (tekst + obrazy), zamiast statycznego images/edits.
    const imageContentParts = [];
    if (usingCustomRefs) {
      designAssets.referenceImages.forEach(function(img){
        imageContentParts.push({ type: 'input_image', image_url: `data:${img.mime};base64,${img.base64}` });
      });
    } else {
      for (const f of references) {
        const buf = fs.readFileSync(path.join(EXAMPLES_DIR, f));
        imageContentParts.push({ type: 'input_image', image_url: `data:image/png;base64,${buf.toString('base64')}` });
      }
    }
    if (designAssets && designAssets.logoDataUrl) {
      imageContentParts.push({ type: 'input_image', image_url: designAssets.logoDataUrl });
    }
    if (wantsPhoto) {
      const b64in = userPhoto.includes(',') ? userPhoto.split(',')[1] : userPhoto;
      imageContentParts.push({ type: 'input_image', image_url: `data:image/jpeg;base64,${b64in}` });
    }

    const promptForApi = prompt + '\n\nWygeneruj teraz obraz tego posta przy uzyciu narzedzia image_generation. Nie odpowiadaj tekstem - wywolaj narzedzie i zwroc obraz.';

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
    if (respData.error) throw new Error('OpenAI: ' + respData.error.message);
    const imgCall = (respData.output || []).find(item => item.type === 'image_generation_call');
    if (!imgCall || !imgCall.result) throw new Error('OpenAI nie zwrocil obrazu (brak image_generation_call w output)');
    const b64 = imgCall.result;

    const uploadedImageUrl = await uploadImageToBlob(b64, 'png');
    res.json({
      image: uploadedImageUrl,
      prompt,
      referencesUsed: usingCustomRefs ? 'project-reference-designs' : references,
      pair: { bg: pair.bg, bgName: pair.bgName, text: pair.text, accent: pair.accent },
      format: format || 'post-4-5',
      size,
      logo: null
    });
  } catch(e) {
    console.error('generate-image:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/design/generate-carousel', async (req, res) => {
  const { post, colorPairIdx, userPhoto, photoDescription, hasPhoto, styleNote, format, slideCount, projectId } = req.body;
  if (!post) return res.status(400).json({ error: 'Brak posta' });
  const OPENAI_KEY = await getOpenAiKey(projectId);

  const pairs = [
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#171717', bgName: 'dark', text: '#F2EDE3', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#D0F200', accentName: 'neon lime' },
    { bg: '#F2EDE3', bgName: 'beige', text: '#171717', accent: '#7648F8', accentName: 'ultraviolet' },
    { bg: '#D0F200', bgName: 'neon', text: '#171717', accent: '#171717', accentName: 'dark' }
  ];
  const pair = pairs[colorPairIdx ?? 2] || pairs[2];
  const wantsPhoto = hasPhoto !== false && !!userPhoto;

  const SIZE_MAP = { 'post-1-1': '1024x1024', 'post-4-5': '1024x1536', 'story': '1024x1536', 'landscape': '1536x1024' };
  const size = SIZE_MAP[format] || '1024x1536';

  const DARK_REFS = ['dark-post-4_5-example-4.png', 'dark-post-square-example-1.png', 'dark-post-square-example-2.png', 'dark-post-square-example-3.png'];
  const LIGHT_REFS = ['light-post-4_5-example-8.png', 'light-post-square-example-5.png', 'light-post-square-example-6.png', 'light-post-square-example-7.png'];
  const references = pair.bgName === 'dark' ? DARK_REFS : LIGHT_REFS;

  try {
    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/schemat/schemat.md');
    const schemaText = fs.readFileSync(schemaPath, 'utf8');
    const EXAMPLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/examples');

    const postText = `Tytul: ${post.title || ''}\n${post.content || ''}`;

    const planPrompt = `Jestes Senior Content Designerem w agencji 25wat. Dzielisz post na karuzele (wielosladowa grafika na social media).
Zasady:
- ${slideCount ? `Wygeneruj dokladnie ${slideCount} slajdow.` : 'Wybierz optymalna liczbe slajdow (4-6) w zaleznosci od tresci - nie za malo, nie za duzo.'}
- Kazdy slajd ma: "headline" (max 3 linie, konkret, zero ogolnikow) i opcjonalnie "subtext" (1 krotkie zdanie, moze byc puste).
- Pierwszy slajd to hook - musi zatrzymac scrolla.
- Ostatni slajd to CTA lub podsumowanie.
- Nie powtarzaj tych samych fraz miedzy slajdami.
- Zero hashtagow, zero pustych sloganow.

Tresc posta:
${postText}

Odpowiedz WYLACZNIE czystym JSON (bez markdown, bez wstepu) w formacie:
{"slides":[{"headline":"...","subtext":"..."}]}`;

    const planReq = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-5',
        input: [{ role: 'user', content: [{ type: 'input_text', text: planPrompt }] }]
      })
    });
    const planData = await planReq.json();
    if (planData.error) throw new Error('OpenAI (plan): ' + planData.error.message);
    const planMsg = (planData.output || []).find(item => item.type === 'message');
    const planTextPart = planMsg && (planMsg.content || []).find(c => c.type === 'output_text');
    if (!planTextPart) throw new Error('OpenAI nie zwrocil planu slajdow');
    let rawPlan = planTextPart.text.trim();
    if (rawPlan.startsWith('```')) rawPlan = rawPlan.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    const plan = JSON.parse(rawPlan);
    const slides = (plan.slides || []).slice(0, 8);
    if (!slides.length) throw new Error('Plan karuzeli jest pusty');

    const baseReferenceParts = [];
    for (const f of references) {
      const buf = fs.readFileSync(path.join(EXAMPLES_DIR, f));
      baseReferenceParts.push({ type: 'input_image', image_url: `data:image/png;base64,${buf.toString('base64')}` });
    }
    let photoPart = null;
    if (wantsPhoto) {
      const b64in = userPhoto.includes(',') ? userPhoto.split(',')[1] : userPhoto;
      photoPart = { type: 'input_image', image_url: `data:image/jpeg;base64,${b64in}` };
    }

    const colorInstruction = `UZYJ DOKLADNIE tej pary kolorow, nie wybieraj innej z tabeli w schemacie: tlo ${pair.bg} (${pair.bgName}), tekst ${pair.text}, akcent ${pair.accent} (${pair.accentName}).`;
    const styleInstruction = styleNote ? `Uwaga stylistyczna od klienta, zastosuj ja: ${styleNote}` : '';
    const photoInstruction = wantsPhoto ? `Ostatni dolaczony obraz referencyjny (przed poprzednimi slajdami karuzeli, jesli sa) to prawdziwe zdjecie osoby z posta - zachowaj jej tozsamosc 1:1 (twarz, wlosy, ubranie, proporcje). Nie zmieniaj tej osoby.` : 'Ten post nie ma zdjecia - czysta kompozycja typograficzna z doodle/flubber zgodnie ze schematem.';

    const COMPOSITION_VARIANTS = [
      "Naglowek w GORNEJ czesci kadru, flubber w PRAWYM DOLNYM rogu, doodle-strzalka wskazujaca z lewej gory na naglowek.",
      "Naglowek WYSRODKOWANY PO LEWEJ (srodek wysokosci kadru), flubber w LEWYM DOLNYM rogu, doodle-underline podkreslajacy kluczowe slowo w naglowku.",
      "Naglowek w DOLNEJ czesci kadru, flubber w PRAWYM GORNYM rogu, doodle-sparkle przy kluczowym slowie lub liczbie.",
      "Naglowek PO PRAWEJ stronie kadru, flubber na dole PO SRODKU, doodle-strzalka skierowana ukosnie od naglowka w dol.",
      "Naglowek w GORNEJ czesci PO LEWEJ, flubber przesuniety w PRAWY SRODEK kadru (nie w rogu), doodle-circle lub x-mark jako akcent przy liczbie/slowie kluczowym."
    ];
    const generatedSlides = await Promise.all(slides.map(async (slide, i) => {
      const headlineInstruction = `Uzyj DOKLADNIE tego headline, nie zmieniaj tresci: "${slide.headline}"` + (slide.subtext ? ` Podtekst/dodatkowa linia: "${slide.subtext}"` : '');
      const compositionVariant = COMPOSITION_VARIANTS[i % COMPOSITION_VARIANTS.length];
      const carouselInstruction = `To jest SLAJD ${i + 1} z ${slides.length} karuzeli. UZYJ TEJ SAMEJ pary kolorow, tej samej rodziny fontu i tego samego charakteru grafiki jak w referencjach - to musi wygladac jak jeden, konsekwentny zestaw. ALE nie powtarzaj identycznego ukladu na kazdym slajdzie - zastosuj TA KONKRETNA kompozycje dla tego slajdu: ${compositionVariant}`;
      const prompt = `${schemaText}\n\n---\n\n${colorInstruction}\n${headlineInstruction}\n\n${carouselInstruction}\n${photoInstruction}\n${styleInstruction}\n\nTresc calego posta (kontekst):\n${postText}\n\nPrzygotuj grafike TEGO SLAJDU zgodnie ze schematem, referencjami i powyzszymi instrukcjami.`;

      const imageContentParts = [...baseReferenceParts];
      if (photoPart) imageContentParts.push(photoPart);

      const promptForApi = prompt + '\n\nWygeneruj teraz obraz tego slajdu przy uzyciu narzedzia image_generation. Nie odpowiadaj tekstem - wywolaj narzedzie i zwroc obraz.';

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
      const imageDataUrl = await uploadImageToBlob(b64, 'png');

      return { image: imageDataUrl, headline: slide.headline, subtext: slide.subtext || '' };
    }));

    res.json({
      slides: generatedSlides,
      pair: { bg: pair.bg, bgName: pair.bgName, text: pair.text, accent: pair.accent },
      format: format || 'post-4-5',
      size
    });
  } catch (e) {
    console.error('generate-carousel:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/design/account-action', async (req, res) => {
  const { message, post, colorPairIdx, hasPhoto, history } = req.body;
  const sys = `Jestes Account Managerem w agencji 25wat. Klient napisal chaotyczna, potocznie sformulowana uwage o designie posta, ktory wlasnie zostal wygenerowany. Twoim zadaniem jest zdecydowac JAKA AKCJE wykonac - nie realizuj jej samemu, tylko sklasyfikuj.

Dostepne akcje:
- "change_color": klient chce innej kolorystyki / palety / tla
- "restyle": klient chce zmiany stylu grafiki (np. mniej ilustracji, bardziej flat/minimalistyczne, inny nastroj, inna kompozycja, cos "dziwne")
- "change_photo": klient chce innego zdjecia albo inaczej pokazanej osoby
- "change_headline": klient chce zmienic naglowek / tekst WIDOCZNY NA SAMEJ GRAFICE (np. "zmien naglowek na...", "popraw tekst na grafice", "niech na obrazku bedzie inny tytul") - to NIE jest to samo co edit_copy
- "edit_copy": klient chce zmienic tresc POSTA (podpis pod grafika), nie tekst na samej grafice
- "clarify": NIE jest jasne o co konkretnie chodzi - zadaj JEDNO precyzyjne pytanie dopytujace, NIE zgaduj

Dostepne pary kolorow (indeks: tlo / tekst / akcent) - UZYWAJ TYCH FAKTYCZNYCH KOLOROW zeby wybrac targetColorPairIdx, nie zgaduj numeru:
0: tlo ciemne #171717, tekst jasny #F2EDE3, akcent ultraviolet #7648F8
1: tlo ciemne #171717, tekst jasny #F2EDE3, akcent neon lime #D0F200
2: tlo jasne/bezowe #F2EDE3, tekst ciemny #171717, akcent neon lime #D0F200
3: tlo jasne/bezowe #F2EDE3, tekst ciemny #171717, akcent ultraviolet #7648F8
4: tlo neonowe #D0F200, tekst ciemny #171717, bez osobnego akcentu

Aktualne ustawienia: para kolorow numer ${typeof colorPairIdx === 'number' ? colorPairIdx : 'nieznana'} (0-4), post ${hasPhoto ? 'ZE zdjeciem' : 'BEZ zdjecia'}.

KRYTYCZNA ZASADA: jesli ponizej w historii rozmowy widac, ze juz wczesniej zadales pytanie typu clarify na ten sam temat i klient odpowiedzial (nawet ogolnikowo, nawet "po prostu wykonaj") - NIE WOLNO Ci zwrocic clarify drugi raz z rzedu na ten sam temat. Zamiast tego podejmij najlepsza mozliwa decyzje na podstawie calej rozmowy i wykonaj akcje. Maksymalnie JEDNO dopytanie na dany temat, potem dzialaj.

Odpowiedz TYLKO JSON: {"action":"change_color|restyle|change_photo|change_headline|edit_copy|clarify","topic":"color|photo|style|headline|copy|other - czego NAJBARDZIEJ dotyczy uwaga klienta, wypelnij zawsze niezaleznie od action","note":"krotka, precyzyjna instrukcja stylu po angielsku dla akcji restyle, w innym przypadku null","clarify":"pytanie po polsku dla akcji clarify, w innym przypadku null","targetColorPairIdx":"liczba 0-4 dla change_color dopasowana do FAKTYCZNYCH kolorow opisanych powyzej, w innym przypadku null","newHeadline":"nowy naglowek na grafike po polsku, max 6 slow, dla akcji change_headline, w innym przypadku null"}`;

  try {
    const historyText = Array.isArray(history) && history.length
      ? '\n\nHistoria tej rozmowy o designie (od najstarszej):\n' + history.map(h => (h.role === 'user' ? 'Klient: ' : 'Account: ') + h.text).join('\n')
      : '';
    const context = `Post: ${post?.title || ''}\nTresc: ${post?.content || ''}${historyText}\n\nOstatnia uwaga klienta: ${message}`;
    const decision = await claude(sys, context);
    res.json(decision);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/design/generate-image-raw', async (req, res) => {
  const { post, userPhoto, projectId } = req.body;
  if (!post) return res.status(400).json({ error: 'Brak posta' });
  if (!userPhoto) return res.status(400).json({ error: 'Brak zdjecia (userPhoto)' });
  const OPENAI_KEY = await getOpenAiKey(projectId);
  if (!OPENAI_KEY) return res.status(500).json({ error: 'Brak OPENAI_KEY na serwerze' });

  try {
    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/schemat/schemat.md');
    const schemaText = fs.readFileSync(schemaPath, 'utf8');

    const EXAMPLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/examples');
    const FIXED_REFERENCES = [
      'light-post-4_5-example-8.png',
      'light-post-square-example-7.png',
      'dark-post-square-example-2.png',
      'light-post-square-example-5.png',
      'dark-post-4_5-example-4.png'
    ];

    const postText = `Tytul: ${post.title || ''}\n${post.content || ''}`;
    const prompt = `${schemaText}\n\n---\n\nTo jest treosc posta:\n${postText}\n\nPrzygotuj grafike zgodnie ze schematem i referencjami. Zachowaj zdjecie.`;

    const form = new FormData();
    form.append('model', 'gpt-image-1');
    for (const f of FIXED_REFERENCES) {
      const buf = fs.readFileSync(path.join(EXAMPLES_DIR, f));
      form.append('image[]', new Blob([buf], { type: 'image/png' }), f);
    }
    const b64in = userPhoto.includes(',') ? userPhoto.split(',')[1] : userPhoto;
    const photoBuf = Buffer.from(b64in, 'base64');
    form.append('image[]', new Blob([photoBuf], { type: 'image/jpeg' }), 'real_photo.jpg');
    form.append('prompt', prompt);

    const imgReq = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: form
    });
    const imgData = await imgReq.json();
    if (imgData.error) throw new Error('OpenAI: ' + imgData.error.message);
    const b64 = imgData.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI nie zwrocil obrazu');

    const uploadedRawUrl = await uploadImageToBlob(b64, 'png');
    res.json({ image: uploadedRawUrl, prompt, referencesUsed: FIXED_REFERENCES });
  } catch(e) {
    console.error('generate-image-raw:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('25wat API running on :' + PORT));

const BRAND_VOICE = `Jesteś copywriterem agencji 25wat (AI Driven Agency, Wrocław). Piszesz posty na Facebook po polsku.

WIEDZA O MARCE (CO komunikować):
- 25wat łączy performance marketing (Meta Ads, Google Ads) z automatyzacją AI procesów sprzedażowych
- Klient idealny: właściciel firmy B2B, 20-120 pracowników, wiek 36-45 lat, zna AI ale go to przerosło
- Główna przewaga: nie sprzedajemy narzędzi z półki - robimy custom automatyzacje dopasowane do infrastruktury klienta
- Bolączki klienta: ręczne powtarzalne czynności, chaos technologiczny, za długi cykl sprzedaży
- Argument ROI: handlowiec kosztuje ~162 000 zł/rok, automatyzacja = ułamek tego jednorazowo

ZASADY GŁOSU:
- Piszesz jak ktoś kto wie co robi i nie marnuje czasu czytelnika
- Bezpośrednio, konkretnie, zero korporacyjnego bełkotu
- Lekka ironia lub suchy humor są ok - bez patosu, bez coachingowej mowy
- Pierwsze zdanie MUSI zatrzymać scrollowanie - liczba, prowokacja lub obserwacja z życia
- Krótkie akapity: 3-6 na post
- Zawsze kończy się punchline lub naturalnym zamknięciem - nie osobną "moralą"
- Obserwacja z życia wygrywa z danymi z raportu
- Jezyk polski z polskimi znakami (ą, ę, ó, ś, ź, ż, ć, ń)

ZAKAZANE SŁOWA: "zagłębiać się", "krajobraz", "fascynujący", "niesamowity", "warto zaznaczyć"
ZAKAZANE OTWARCIA: "Jako agencja...", "Chcemy się podzielić...", "W dzisiejszych czasach..."
ZAKAZANA STRUKTURA: numerowane listy jako główna treść posta

ZAKAZY TREŚCI:
- NIE PISZ: "nasz system", "gwarantujemy", "nasz agent AI"
- NIGDY nie wymyślaj fikcyjnych firm, imion klientów ani konkretnych wyników których nie znasz
- Jeśli chcesz podać przykład - użyj: "jeden z naszych klientów z branży produkcyjnej" bez konkretów

FORMAT FB:
- Długość: 150-250 słów
- Emoji: max 2-3, tylko jako separatory sekcji, nie dekoracja
- CTA na końcu: pytanie do odbiorcy lub zaproszenie do kontaktu

UNIKAJ FORM TYPOWYCH DLA AI:
- Nie zaczynaj zdań od "Warto zauważyć", "Należy podkreślić", "Jest to kluczowe"
- Nie używaj konstrukcji "nie tylko... ale także", "zarówno... jak i"
- Nie pisz w stylu raportu ani prezentacji PowerPoint
- Unikaj pustych przymiotników: "kluczowy", "istotny", "efektywny", "skuteczny" bez uzasadnienia
- Pisz jak człowiek który mówi do drugiego człowieka, nie jak asystent AI

INTERPUNKCJA I JĘZYK:
- Używaj wyłącznie krótkiego myślnika (-) lub półpauzy (–), NIGDY długiej pauzy (—)
- Polskie znaki obowiązkowe: ą, ę, ó, ś, ź, ż, ć, ń, ł - zawsze
- Przecinki przed "który", "która", "które", "że", "bo", "ale", "jednak"
- Nie stawiaj przecinka przed "i" łączącym dwa elementy
- Zdania krótkie. Maksymalnie 2 przecinki w jednym zdaniu.
- Unikaj strony biernej ("zostało wdrożone" → "wdrożyliśmy")`;

const LEGACY_25WAT_PROJECT_ID = 1;

async function getProjectCompetitors(projectId) {
  try {
    if (projectId) {
      const result = await pool.query(
        "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'competitors' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        [projectId]
      );
      const text = result.rows[0] && result.rows[0].text_content;
      if (text) {
        return text.split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(l => l.length > 0).map(line => {
          const parts = line.split('|').map(p => p.trim());
          const name = parts[0] || line;
          const url = parts[1] || '';
          let domain = '';
          if (url) {
            try { domain = new URL(/^https?:\/\//.test(url) ? url : ('https://' + url)).hostname.replace(/^www\./, ''); } catch (e) {}
          }
          const query = domain
            ? name + ' social media content 2026'
            : '"' + name + '" (firma OR spolka OR marka OR company) social media content 2026';
          return { name, query, domains: domain ? [domain, 'linkedin.com'] : undefined };
        });
      }
    }
  } catch (e) {
    console.error('getProjectCompetitors:', e.message);
  }
  return (Number(projectId) === LEGACY_25WAT_PROJECT_ID) ? COMPETITORS : [];
}

async function getProjectTrendsFocus(projectId) {
  const DEFAULT_FOCUS = 'AI automatyzacja marketing B2B Polska';
  try {
    if (projectId) {
      const result = await pool.query(
        "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'trends_focus' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        [projectId]
      );
      const text = result.rows[0] && result.rows[0].text_content;
      if (text && text.trim()) return text.trim();
    }
  } catch (e) {
    console.error('getProjectTrendsFocus:', e.message);
  }
  return (Number(projectId) === LEGACY_25WAT_PROJECT_ID) ? DEFAULT_FOCUS : null;
}

async function getProjectBrandContext(projectId) {
  if (!projectId) return null;
  if (Number(projectId) === LEGACY_25WAT_PROJECT_ID) return null;
  try {
    const result = await pool.query(
      "SELECT category, text_content FROM brand_assets WHERE project_id = $1 AND category IN ('brand_context','tone_of_voice','ai_context','ai_context_rules') AND text_content IS NOT NULL ORDER BY created_at DESC",
      [projectId]
    );
    if (!result.rows.length) return null;
    const byCat = {};
    result.rows.forEach(r => { if (!byCat[r.category]) byCat[r.category] = r.text_content; });
    const parts = [];
    if (byCat.ai_context_rules) parts.push('TWOJE WYTYCZNE (zawsze obowiazujace, nadrzedne wobec reszty):\n' + byCat.ai_context_rules);
    if (byCat.brand_context) parts.push('BRAND STRATEGY:\n' + byCat.brand_context);
    if (byCat.tone_of_voice) parts.push('TONE OF VOICE:\n' + byCat.tone_of_voice);
    if (byCat.ai_context) parts.push('AI CONTEXT (design, konkurencja):\n' + byCat.ai_context);
    return parts.length ? parts.join('\n\n') : null;
  } catch (e) {
    console.error('getProjectBrandContext:', e.message);
    return null;
  }
}

async function getProjectDesignAssets(projectId) {
  if (!projectId || Number(projectId) === LEGACY_25WAT_PROJECT_ID) return null;
  try {
    const projRes = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    const brandName = projRes.rows[0] ? projRes.rows[0].name : null;

    const logoRes = await pool.query(
      "SELECT file_data, mime_type FROM brand_assets WHERE project_id = $1 AND category = 'logo' AND file_data IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const refRes = await pool.query(
      "SELECT file_data, mime_type FROM brand_assets WHERE project_id = $1 AND category = 'reference_designs' AND file_data IS NOT NULL ORDER BY created_at DESC LIMIT 4",
      [projectId]
    );
    const ctxRes = await pool.query(
      "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'ai_context' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const bookRes = await pool.query(
      "SELECT text_content FROM brand_assets WHERE project_id = $1 AND category = 'brandbook' AND text_content IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    const brandbookText = bookRes.rows[0] ? bookRes.rows[0].text_content : '';
    const aiContextText = (brandbookText ? ('BRANDBOOK:\n' + brandbookText + '\n\n') : '') + (ctxRes.rows[0] ? ctxRes.rows[0].text_content : '');

    const namedColors = [];
    const seenHexForNames = new Set();
    aiContextText.split('\n').forEach(line => {
      if (namedColors.length >= 8) return;
      const nameMatch = line.match(/\*\*([^*\n]{2,40}?)\*\*/);
      const hexMatch = line.match(/#[0-9A-Fa-f]{6}/);
      if (!nameMatch || !hexMatch) return;
      const hex = hexMatch[0].toUpperCase();
      if (seenHexForNames.has(hex)) return;
      seenHexForNames.add(hex);
      namedColors.push({ name: nameMatch[1].trim(), hex });
    });
    const hexMatches = [...new Set((aiContextText.match(/#[0-9A-Fa-f]{6}/g) || []).map(h => h.toUpperCase()))];
    let colorPairs = null;
    if (namedColors.length >= 2) {
      const white = namedColors.find(c => c.hex === '#FFFFFF');
      const primary = namedColors[0];
      const accents = namedColors.slice(1).filter(c => c.hex !== '#FFFFFF');
      colorPairs = accents.slice(0, 4).map(acc => ({
        bg: primary.hex, bgName: primary.name, text: white ? white.hex : '#FFFFFF',
        accent: acc.hex, accentName: acc.name, name: primary.name + ' + ' + acc.name
      }));
      if (white && accents[0]) {
        colorPairs.push({ bg: white.hex, bgName: white.name, text: primary.hex, accent: accents[0].hex, accentName: accents[0].name, name: white.name + ' + ' + primary.name });
      }
      if (!colorPairs.length) colorPairs = null;
    } else if (hexMatches.length >= 2) {
      const c0 = hexMatches[0], c1 = hexMatches[1], c2 = hexMatches[2] || hexMatches[0];
      colorPairs = [
        { bg: c0, bgName: 'primary', text: c1, accent: c2, accentName: 'accent', name: 'Wariant 1' },
        { bg: c1, bgName: 'secondary', text: c0, accent: c2, accentName: 'accent', name: 'Wariant 2' }
      ];
    }

    const logoRow = logoRes.rows[0] || null;
    let logoDataUrl = null;
    if (logoRow) {
      const isSvg = logoRow.mime_type === 'image/svg+xml' || (logoRow.filename && /\.svg$/i.test(logoRow.filename));
      if (isSvg) {
        try {
          const pngBuf = await sharp(logoRow.file_data).png().toBuffer();
          logoDataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`;
        } catch (svgErr) {
          console.error('logo svg->png convert:', svgErr.message);
          logoDataUrl = `data:${logoRow.mime_type || 'image/png'};base64,${logoRow.file_data.toString('base64')}`;
        }
      } else {
        logoDataUrl = `data:${logoRow.mime_type || 'image/png'};base64,${logoRow.file_data.toString('base64')}`;
      }
    }
    const referenceImages = await Promise.all(refRes.rows.map(async (r) => {
      if (r.mime_type === 'image/svg+xml') {
        try {
          const pngBuf = await sharp(r.file_data).png().toBuffer();
          return { base64: pngBuf.toString('base64'), mime: 'image/png' };
        } catch (svgErr) {
          console.error('reference svg->png convert:', svgErr.message);
        }
      }
      return { base64: r.file_data.toString('base64'), mime: r.mime_type || 'image/png' };
    }));

    return { brandName, logoDataUrl, referenceImages, aiContextText, colorPairs };
  } catch (e) {
    console.error('getProjectDesignAssets:', e.message);
    return null;
  }
}

app.get('/api/projects/:projectId/color-pairs', requireAuth, requireProjectMember, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const designAssets = await getProjectDesignAssets(req.projectId);
    res.json({ colorPairs: (designAssets && designAssets.colorPairs) ? designAssets.colorPairs : null });
  } catch (e) {
    console.error('color-pairs:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:projectId/assets/generate-ai-context', requireAuth, requireProjectMember, async (req, res) => {
  try {
    const textResult = await pool.query(
      "SELECT category, text_content FROM brand_assets WHERE project_id = $1 AND category IN ('brand_context','tone_of_voice','brandbook') AND text_content IS NOT NULL ORDER BY created_at DESC",
      [req.projectId]
    );
    const byCat = {};
    textResult.rows.forEach(r => {
      if (!byCat[r.category]) byCat[r.category] = [];
      byCat[r.category].push(r.text_content);
    });
    Object.keys(byCat).forEach(k => { byCat[k] = byCat[k].join('\n\n---\n\n'); });
    if (!byCat.brand_context && !byCat.tone_of_voice && !byCat.brandbook) {
      return res.status(400).json({ error: 'Wgraj najpierw Brandbook, Brand Strategy lub Tone of Voice (tekst albo plik) - AI potrzebuje materialu zrodlowego.' });
    }

    const imgResult = await pool.query(
      "SELECT file_data, mime_type FROM brand_assets WHERE project_id = $1 AND category = 'reference_designs' AND file_data IS NOT NULL ORDER BY created_at DESC LIMIT 4",
      [req.projectId]
    );

    const sys = 'Jestes Strategiem Brandowym. Na podstawie materialow zrodlowych klienta (brandbook, brand strategy, tone of voice, przykladowe kreacje graficzne) zbuduj DOKUMENT "AI CONTEXT" ktory bedzie zasilal generowanie tresci i grafik dla tej marki. Jesli w materialach jest sekcja BRANDBOOK - to zrodlo najwyzszego priorytetu, nadrzedne wobec wnioskow wyciaganych z samych zdjec.\n\nStruktura dokumentu (trzymaj sie dokladnie tych sekcji, po polsku):\n\n## PALETA KOLOROW\n- KONIECZNIE podaj dokladny kod HEX (#RRGGBB) dla kazdego koloru, obok jego nazwy (np. "Rozowy/malinowy #E6007E"). Jesli w BRANDBOOK sa podane kody HEX - uzyj ich dokladnie, nie szacuj. Jesli nie ma HEX w tekscie ale widac kolory na przykladowych grafikach - oszacuj najblizszy kod HEX i zawsze go podaj - nigdy nie ograniczaj sie do samej nazwy slownej koloru. Jesli brak jakichkolwiek danych o kolorach - napisz "brak danych - pomin, dopisac pozniej".\n\n## TYPOGRAFIA\n- Charakter fontu widoczny na grafikach (szeryfowy/bezszeryfowy, grubosc, styl naglowkow). Jesli brak danych - napisz "brak danych - pomin".\n\n## KOMPOZYCJA I HIERARCHIA\n- Wzorzec ukladu widoczny na przykladowych kreacjach (logo, tekst, ilosc bialej przestrzeni). Jesli brak - "brak danych - pomin".\n\n## STYL ZDJEC\n- Jesli na przykladach sa zdjecia - opisz styl. Jesli brak - "brak danych - pomin".\n\n## CZERWONE LINIE\n- Czego marka na pewno unika, wywnioskowane z brand strategy/tone of voice.\n\n## VOICE & TON (podsumowanie)\n- 3-4 zdania kluczowych cech tonu marki, wyciagniete z materialow.\n\nNie zmyslaj kolorow, fontow ani faktow ktorych nie widac w materiale. Gdy czegos brakuje - napisz wprost "brak danych - pomin, dopisac pozniej" zamiast wymyslac.';

    const contentBlocks = [];
    if (byCat.brandbook) contentBlocks.push({ type: 'text', text: 'BRANDBOOK (zrodlo najwyzszego priorytetu):\n' + byCat.brandbook });
    if (byCat.brand_context) contentBlocks.push({ type: 'text', text: 'BRAND STRATEGY:\n' + byCat.brand_context });
    if (byCat.tone_of_voice) contentBlocks.push({ type: 'text', text: 'TONE OF VOICE:\n' + byCat.tone_of_voice });
    imgResult.rows.forEach(row => {
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: row.mime_type || 'image/png', data: row.file_data.toString('base64') }
      });
    });
    if (!imgResult.rows.length) contentBlocks.push({ type: 'text', text: '(Brak przykladowych kreacji - pomin sekcje PALETA/TYPOGRAFIA/KOMPOZYCJA/STYL ZDJEC jako "brak danych")' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4096, system: sys, messages: [{ role: 'user', content: contentBlocks }] })
    });
    const data = await r.json();
    const generated = (data.content && data.content[0] && data.content[0].text) || '';
    if (!generated) return res.status(500).json({ error: 'Brak odpowiedzi od AI' });
    res.json({ generated });
  } catch (e) {
    console.error('generate-ai-context:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/content/generate', async (req, res) => {
  const { topic, projectId, channel } = req.body;
  if (!topic) return res.status(400).json({ error: 'Brak tematu' });
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
- Ton biznesowy, ekspercki. Emoji TYLKO jako wskaznik pojedynczej kluczowej linii (np. przed CTA/pytaniem, lokalizacja, data) - max 2-3 takie akcenty, nigdy jako dekoracja calego tekstu czy zamiennik punktorow
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
    const customBrandContext = await getProjectBrandContext(projectId);
    const systemPrompt = customBrandContext
      ? customBrandContext + '\n\n---\n\nPisz posty na ' + ch.label + ' po polsku, zgodnie z powyzszym kontekstem marki (strategia, tone of voice).'
      : BRAND_VOICE;
    let brandLabel = 'agencji 25wat';
    if (projectId && Number(projectId) !== LEGACY_25WAT_PROJECT_ID) {
      try {
        const projRes = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
        if (projRes.rows[0] && projRes.rows[0].name) brandLabel = 'marki ' + projRes.rows[0].name;
      } catch (e) { console.error('brandLabel lookup:', e.message); }
    }
    const typesExample = ch.types.map((t, i) => i === 0
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
{"posts":[${typesExample}]}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) { const e = await r.text(); throw new Error('Claude ' + r.status + ': ' + e); }
    const data = await r.json();
    const raw = (data.content.find(b => b.type === 'text')?.text || '{}').replace(/```json|```/g,'').replace(/[\u2013\u2014]/g,'-').trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e) {
      const cleaned = raw.replace(/[\u2013\u2014]/g,'-').replace(/[\u201c\u201d\u201e\u201f]/g,'"').replace(/[\u2018\u2019]/g,"'").replace(/,(\s*[}\]])/g,'$1');
      parsed = JSON.parse(cleaned);
    }
    res.json(parsed);
  } catch(e) { console.error(e.message); res.status(500).json({ error: e.message }); }
});

app.post('/api/content/proofread', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Brak tekstu' });
  try {
    const sys = `Jestes korektorem jezykowym marki 25wat. Poprawiasz tekst posta social media - TYLKO jezykowo, nie zmieniasz sensu, dlugosci ani struktury.

Zakres poprawek:
- Interpunkcja: przecinki, kropki, myslniki krotkie (-) zamieniaj na polpauzy (\u2013) tam gdzie gramatycznie wlasciwe
- Ortografia i gramatyka
- Powtorzenia lekyskalne - zamien na synonimy
- Stylistyka: usun kalki z angielskiego, korpomowe sformulowania, puste slogany, nadmiernie poprawne/sztywne konstrukcje ktore brzmia jak AI
- Tekst ma brzmiec naturalnie, jak napisany przez czlowieka - nie poprawiaj na sile, jesli oryginal juz brzmi dobrze

NIE ROB: nie zmieniaj tresci merytorycznej, nie wydluzaj, nie skracaj, nie dodawaj nowych mysli, nie zmieniaj tonu.

Odpowiedz TYLKO w formacie JSON: {"corrected":"poprawiony tekst z enterami jako nowe linie"}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys, messages: [{ role: 'user', content: 'Tekst do korekty:\n' + text }] })
    });
    if (!r.ok) { const e = await r.text(); throw new Error('Claude ' + r.status + ': ' + e); }
    const data = await r.json();
    const raw = (data.content.find(b => b.type === 'text')?.text || '{}').replace(/```json|```/g,'').trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e) {
      const cleaned = raw.replace(/[\u201c\u201d\u201e\u201f]/g,'"').replace(/[\u2018\u2019]/g,"'").replace(/,(\s*[}\]])/g,'$1');
      parsed = JSON.parse(cleaned);
    }
    res.json({ corrected: parsed.corrected || text });
  } catch(e) {
    console.error('content/proofread:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/account/chat', async (req, res) => {
  const { message, systemPrompt } = req.body;
  if (!message) return res.status(400).json({ error: 'Brak wiadomości' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: systemPrompt || 'Jesteś Account Managerem w 25wat. Odpowiadasz po polsku, konkretnie.', messages: [{ role: 'user', content: message }] })
    });
    const data = await r.json();
    const text = data.content?.find(b => b.type === 'text')?.text || 'Błąd';
    res.json({ text });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
