// @ts-nocheck
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { createClient } from 'redis';
import multer from 'multer';
import mammoth from 'mammoth';
import prisma from './prisma.js';
import { fileURLToPath } from 'url';
import chatRouter from './src/routes/chat.js';

const app = express();
const PORT = process.env.PORT || 4000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

const stripHtml = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(ROOT_DIR, 'ntools');

if (!fs.existsSync(TOOLS_DIR)) {
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
}

app.use('/ntools', express.static(TOOLS_DIR));
app.use('/api', chatRouter);

const computeProgress = (steps = []) => {
  if (!steps.length) return 0;
  const done = steps.filter((s) => s.completed).length;
  return Number((done / steps.length).toFixed(2));
};

const deriveStatus = (progress) => {
  if (progress >= 1) return 'done';
  if (progress > 0) return 'in-progress';
  return 'open';
};

const augmentTask = (task) => {
  const progress = computeProgress(task.steps || []);
  const status = deriveStatus(progress);
  return { ...task, progress, status };
};

const ensureStepShape = (steps = []) =>
  steps.map((s) => ({
    id: s.id || nanoid(),
    title: s.title || '',
    link: s.link || '',
    completed: Boolean(s.completed),
  }));

// Redis cache (for templates/categories/guides)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = createClient({ url: redisUrl });
let cacheReady = false;
const CACHE_TTL = 300;

redis.on('error', (err) => {
  console.error('Redis error', err);
  cacheReady = false;
});

redis
  .connect()
  .then(() => {
    cacheReady = true;
    console.log('Redis cache connected');
  })
  .catch((err) => {
    cacheReady = false;
    console.error('Redis connection failed, continuing without cache', err);
  });

const cacheGet = async (key) => {
  if (!cacheReady) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const cacheSet = async (key, data) => {
  if (!cacheReady) return;
  try {
    await redis.setEx(key, CACHE_TTL, JSON.stringify(data));
  } catch {
    /* ignore cache errors */
  }
};

const cacheDel = async (...keys) => {
  if (!cacheReady) return;
  try {
    await redis.del(keys);
  } catch {
    /* ignore cache errors */
  }
};

// Health
app.get('/api/health', async (_req, res) => {
  let db = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error('DB health check failed', e);
    db = 'error';
  }
  res.json({ ok: true, db, cache: cacheReady ? 'connected' : 'unavailable' });
});

// Users
app.get('/api/users', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const user = await prisma.user.create({ data: { name, email: email || '' } });
  res.status(201).json(user);
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { name, email },
    });
    res.json(user);
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.task.updateMany({ where: { userId: id }, data: { userId: null } });
    await prisma.user.delete({ where: { id } });
  } catch {
    // ignore not found
  }
  res.sendStatus(204);
});

// Templates (cached)
const TEMPLATE_CACHE = 'templates';
const CATEGORY_CACHE = 'categories';
const GUIDE_CACHE_KEY = 'guides:all';

app.get('/api/templates', async (_req, res) => {
  const cached = await cacheGet(TEMPLATE_CACHE);
  if (cached) return res.json(cached);
  const templates = await prisma.template.findMany({ orderBy: { createdAt: 'desc' } });
  await cacheSet(TEMPLATE_CACHE, templates);
  res.json(templates);
});

app.post('/api/templates', async (req, res) => {
  const { name, steps = [], defaultStartDate, defaultEndDate } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name is required' });
  const normalizedSteps = steps.map((s) => ({ id: s.id || nanoid(), title: s.title || '', link: s.link || '' }));
  const template = await prisma.template.create({
    data: {
      name,
      steps: normalizedSteps,
      defaultStartDate: defaultStartDate || '',
      defaultEndDate: defaultEndDate || '',
    },
  });
  await cacheDel(TEMPLATE_CACHE);
  res.status(201).json(template);
});

app.put('/api/templates/:id', async (req, res) => {
  const { id } = req.params;
  const { name, steps = [], defaultStartDate, defaultEndDate } = req.body;
  const normalizedSteps = steps.map((s) => ({ id: s.id || nanoid(), title: s.title || '', link: s.link || '' }));
  try {
    const template = await prisma.template.update({
      where: { id },
      data: {
        name,
        steps: normalizedSteps,
        defaultStartDate,
        defaultEndDate,
      },
    });
    await cacheDel(TEMPLATE_CACHE);
    res.json(template);
  } catch {
    res.status(404).json({ error: 'Template not found' });
  }
});

app.delete('/api/templates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.task.updateMany({ where: { templateId: id }, data: { templateId: null } });
    await prisma.template.delete({ where: { id } });
    await cacheDel(TEMPLATE_CACHE);
  } catch {
    // ignore
  }
  res.sendStatus(204);
});

// Services (Postman-like)
const normalizeRequestPayload = (r = {}) => ({
  id: r.id || nanoid(),
  name: r.name || 'Unnamed',
  method: r.method || 'GET',
  url: r.url || '',
  folder: r.folder || '',
  params: Array.isArray(r.params) ? r.params : [],
  headers: Array.isArray(r.headers) ? r.headers : [],
  body: r.body || '',
  authType: r.authType || '',
  bearer: r.bearer || '',
  responses: Array.isArray(r.responses) ? r.responses : [],
});

app.get('/api/services', async (_req, res) => {
  const requests = await prisma.serviceRequest.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(requests);
});

app.post('/api/services/import', async (req, res) => {
  const incoming = Array.isArray(req.body.requests) ? req.body.requests : [];
  if (!incoming.length) return res.status(400).json({ error: 'No requests to import' });

  const saved = [];
  for (const raw of incoming) {
    const data = normalizeRequestPayload(raw);
    const created = await prisma.serviceRequest.create({ data });
    saved.push(created);
  }
  res.status(201).json(saved);
});

app.post('/api/services', async (req, res) => {
  const data = normalizeRequestPayload(req.body);
  if (!data.url) return res.status(400).json({ error: 'URL is required' });
  const created = await prisma.serviceRequest.create({ data });
  res.status(201).json(created);
});

app.put('/api/services/:id', async (req, res) => {
  const { id } = req.params;
  const data = normalizeRequestPayload({ ...req.body, id });
  try {
    const updated = await prisma.serviceRequest.update({ where: { id }, data });
    res.json(updated);
  } catch {
    res.status(404).json({ error: 'Service not found' });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.serviceRequest.delete({ where: { id } });
  } catch {
    // ignore missing
  }
  res.sendStatus(204);
});

app.post('/api/services/:id/duplicate', async (req, res) => {
  const { id } = req.params;
  try {
    const original = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!original) return res.status(404).json({ error: 'Service not found' });
    const copy = await prisma.serviceRequest.create({
      data: {
        name: `${original.name} Copy`,
        method: original.method,
        url: original.url,
        folder: original.folder,
        params: original.params,
        headers: original.headers,
        body: original.body,
        authType: original.authType,
        bearer: original.bearer,
        responses: original.responses,
      },
    });
    res.status(201).json(copy);
  } catch {
    res.status(500).json({ error: 'Could not duplicate service' });
  }
});

// Categories (cached)

app.get('/api/categories', async (req, res) => {
  const { search = '' } = req.query;
  if (!search) {
    const cached = await cacheGet(CATEGORY_CACHE);
    if (cached) return res.json(cached);
  }

  let categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  if (search) {
    const text = search.toString().toLowerCase();
    categories = categories.filter((c) => (c.name || '').toLowerCase().includes(text));
  } else {
    await cacheSet(CATEGORY_CACHE, categories);
  }
  res.json(categories);
});

app.post('/api/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  try {
    const cat = await prisma.category.create({
      data: { name },
    });
    await cacheDel(CATEGORY_CACHE, GUIDE_CACHE_KEY);
    res.status(201).json(cat);
  } catch (e) {
    res.status(409).json({ error: 'Category already exists' });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const cat = await prisma.category.update({ where: { id }, data: { name } });
    await cacheDel(CATEGORY_CACHE, GUIDE_CACHE_KEY);
    res.json(cat);
  } catch {
    res.status(404).json({ error: 'Category not found' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.guide.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await prisma.category.delete({ where: { id } });
    await cacheDel(CATEGORY_CACHE, GUIDE_CACHE_KEY);
  } catch {
    // ignore
  }
  res.sendStatus(204);
});

// Guides (cached)
app.get('/api/guides', async (req, res) => {
  const { search = '' } = req.query;
  const hasSearch = Boolean(search);

  if (!hasSearch) {
    const cached = await cacheGet(GUIDE_CACHE_KEY);
    if (cached) return res.json(cached);
  }

  const guides = await prisma.guide.findMany({
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  });

  let result = guides.map((g) => ({
    ...g,
    categoryName: g.category?.name || 'ללא קטגוריה',
  }));

  if (hasSearch) {
    const text = search.toString().toLowerCase();
    result = result.filter(
      (g) =>
        g.title.toLowerCase().includes(text) ||
        (g.categoryName || '').toLowerCase().includes(text) ||
        (g.content || '').toLowerCase().includes(text)
    );
  } else {
    await cacheSet(GUIDE_CACHE_KEY, result);
  }

  res.json(result);
});

app.post('/api/guides', async (req, res) => {
  const { title, categoryId = null, content = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const normalizedCategory =
    categoryId && typeof categoryId === 'string' && categoryId.trim() !== '' ? categoryId.trim() : null;
  if (normalizedCategory) {
    const exists = await prisma.category.findUnique({ where: { id: normalizedCategory } });
    if (!exists) return res.status(400).json({ error: 'Category does not exist' });
  }
  const guide = await prisma.guide.create({
    data: {
      title,
      categoryId: normalizedCategory,
      content,
    },
  });
  await cacheDel(GUIDE_CACHE_KEY);
  res.status(201).json(guide);
});

app.post('/api/guides/import-word', upload.single('file'), async (req, res) => {
  const { title = '', categoryId = null } = req.body || {};
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'Word file is required' });
  const isDocx = /\.docx$/i.test(file.originalname || '');
  if (!isDocx) return res.status(400).json({ error: 'Only .docx files are supported' });

  const normalizedCategory =
    categoryId && typeof categoryId === 'string' && categoryId.trim() !== '' ? categoryId.trim() : null;
  if (normalizedCategory) {
    const exists = await prisma.category.findUnique({ where: { id: normalizedCategory } });
    if (!exists) return res.status(400).json({ error: 'Category does not exist' });
  }

  let htmlContent = '';
  try {
    const result = await mammoth.convertToHtml({ buffer: file.buffer });
    htmlContent = (result.value || '').trim();
  } catch (err) {
    console.error('Failed to parse docx', err);
    return res.status(400).json({ error: 'Failed to read Word file' });
  }

  if (!htmlContent) return res.status(400).json({ error: 'The Word file is empty' });

  const fallbackTitle = (file.originalname || 'מדריך חדש').replace(/\.docx$/i, '').trim() || 'מדריך חדש';
  const finalTitle = (title && title.trim()) || fallbackTitle;

  const guide = await prisma.guide.create({
    data: {
      title: finalTitle,
      categoryId: normalizedCategory,
      content: htmlContent,
    },
  });

  await cacheDel(GUIDE_CACHE_KEY);
  res.status(201).json(guide);
});

app.put('/api/guides/:id', async (req, res) => {
  const { id } = req.params;
  const { title, categoryId, content } = req.body;
  const normalizedCategory =
    categoryId && typeof categoryId === 'string' && categoryId.trim() !== '' ? categoryId.trim() : null;
  if (normalizedCategory) {
    const exists = await prisma.category.findUnique({ where: { id: normalizedCategory } });
    if (!exists) return res.status(400).json({ error: 'Category does not exist' });
  }
  try {
    const guide = await prisma.guide.update({
      where: { id },
      data: {
        title,
        categoryId: normalizedCategory,
        content,
      },
    });
    await cacheDel(GUIDE_CACHE_KEY);
    res.json(guide);
  } catch {
    res.status(404).json({ error: 'Guide not found' });
  }
});

app.delete('/api/guides/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.guide.delete({ where: { id } });
    await cacheDel(GUIDE_CACHE_KEY);
  } catch {
    // ignore
  }
  res.sendStatus(204);
});

// Notes
app.get('/api/notes', async (req, res) => {
  const { search = '' } = req.query;
  const where = search
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined;
  const notes = await prisma.note.findMany({ where, orderBy: { updatedAt: 'desc' } });
  res.json(notes);
});

app.post('/api/notes', async (req, res) => {
  const { title = '', content = '' } = req.body;
  if (!title && !content) return res.status(400).json({ error: 'Title or content is required' });
  const note = await prisma.note.create({
    data: { title, content },
  });
  res.status(201).json(note);
});

app.put('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    const note = await prisma.note.update({
      where: { id },
      data: { title, content },
    });
    res.json(note);
  } catch {
    res.status(404).json({ error: 'Note not found' });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.note.delete({ where: { id } });
  } catch {
    // ignore
  }
  res.sendStatus(204);
});

// Data tables (grid)
const normalizeGrid = (columns = [], rows = []) => {
  const safeCols = Array.isArray(columns) ? columns : [];
  const width = safeCols.length || 0;
  const safeRows = Array.isArray(rows) ? rows : [];
  const normalizedRows = safeRows.map((r) => {
    const base = Array.isArray(r) ? r : [];
    if (base.length < width) return [...base, ...Array(width - base.length).fill('')];
    if (base.length > width) return base.slice(0, width);
    return base;
  });
  return { columns: safeCols, rows: normalizedRows };
};

const tableMatchesSearch = (table, term) => {
  if (!term) return true;
  const lower = term.toLowerCase();
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const haystack = [
    table.name || '',
    columns.join(' '),
    ...rows.map((row) => (Array.isArray(row) ? row.join(' ') : JSON.stringify(row || ''))),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(lower);
};

app.get('/api/tables', async (req, res) => {
  const { search = '' } = req.query;
  const tables = await prisma.dataTable.findMany({ orderBy: { updatedAt: 'desc' } });
  if (search) {
    const term = search.toString();
    return res.json(tables.filter((t) => tableMatchesSearch(t, term)));
  }
  res.json(tables);
});

app.get('/api/tables/:id', async (req, res) => {
  const { id } = req.params;
  const table = await prisma.dataTable.findUnique({ where: { id } });
  if (!table) return res.status(404).json({ error: 'Table not found' });
  res.json(table);
});

app.post('/api/tables', async (req, res) => {
  const { name, columns = [], rows = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const { columns: normalizedCols, rows: normalizedRows } = normalizeGrid(columns, rows);
  const created = await prisma.dataTable.create({
    data: { name, columns: normalizedCols, rows: normalizedRows },
  });
  res.status(201).json(created);
});

app.put('/api/tables/:id', async (req, res) => {
  const { id } = req.params;
  const { name, columns = [], rows = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const { columns: normalizedCols, rows: normalizedRows } = normalizeGrid(columns, rows);
    const updated = await prisma.dataTable.update({
      where: { id },
      data: { name, columns: normalizedCols, rows: normalizedRows },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: 'Table not found' });
  }
});

app.delete('/api/tables/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.dataTable.delete({ where: { id } });
  } catch {
    // ignore
  }
  res.sendStatus(204);
});

// Favorites
app.get('/api/favorites', async (req, res) => {
  const { search = '' } = req.query;
  const where = search
    ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined;
  const favorites = await prisma.favorite.findMany({ where, orderBy: { updatedAt: 'desc' } });
  res.json(favorites);
});

app.post('/api/favorites', async (req, res) => {
  const { title, content = '', link = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const fav = await prisma.favorite.create({
    data: { title, content, link },
  });
  res.status(201).json(fav);
});

app.put('/api/favorites/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content, link } = req.body;
  try {
    const fav = await prisma.favorite.update({
      where: { id },
      data: { title, content, link },
    });
    res.json(fav);
  } catch {
    res.status(404).json({ error: 'Favorite not found' });
  }
});

app.delete('/api/favorites/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.favorite.delete({ where: { id } });
  } catch {
    // ignore
  }
  res.sendStatus(204);
});

// Import favorites from Chrome/HTML bookmarks (Netscape format)
app.post('/api/favorites/import', async (req, res) => {
  const { html = '' } = req.body;
  if (!html.trim()) return res.status(400).json({ error: 'html is required' });

  // crude anchor extraction: <A ... HREF="url">title</A>
  const anchorRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  const anchors = [];
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const link = match[1]?.trim();
    const title = match[2]?.replace(/<[^>]+>/g, '').trim();
    if (link && title) anchors.push({ link, title });
  }

  if (!anchors.length) return res.status(400).json({ error: 'No links found' });

  const existing = await prisma.favorite.findMany({
    where: { link: { in: anchors.map((a) => a.link) } },
    select: { link: true },
  });
  const existingLinks = new Set(existing.map((e) => e.link));
  const toCreate = anchors.filter((a) => !existingLinks.has(a.link));

  if (!toCreate.length) return res.json({ created: 0, skipped: anchors.length });

  await prisma.favorite.createMany({
    data: toCreate.map((a) => ({ title: a.title, link: a.link, content: '' })),
  });

  res.json({ created: toCreate.length, skipped: anchors.length - toCreate.length });
});

// Bot (search in guides + notes)
app.post('/api/bot', async (req, res) => {
  const { question = '' } = req.body;
  const text = question.toLowerCase();
  const [notes, guides, favorites] = await Promise.all([
    prisma.note.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.guide.findMany({ include: { category: true }, orderBy: { updatedAt: 'desc' } }),
    prisma.favorite.findMany({ orderBy: { updatedAt: 'desc' } }),
  ]);

  const corpus = [
    ...notes.map((n) => ({
      type: 'note',
      title: n.title || 'Note',
      content: n.content || '',
      source: 'note',
    })),
    ...guides.map((g) => ({
      type: 'guide',
      title: g.title || 'Guide',
      content: g.content || '',
      categoryName: g.category?.name || '',
      source: 'guide',
    })),
    ...favorites.map((f) => ({
      type: 'favorite',
      title: f.title || 'Favorite',
      content: f.content || '',
      link: f.link || '',
      source: 'favorite',
    })),
  ];

  const scored = corpus
    .map((item) => {
      const hay = `${item.title} ${item.content}`.toLowerCase();
      const score = text
        .split(/\s+/)
        .filter(Boolean)
        .reduce((acc, term) => (hay.includes(term) ? acc + 1 : acc), 0);
      return { ...item, score };
    })
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const answer =
    scored.length > 0
      ? scored
          .map((i, idx) => {
            const clean = stripHtml(i.content || '').slice(0, 320);
            const where =
              i.source === 'guide'
                ? `נמצא במודול "מדריכים" — במדריך בשם "${i.title}"${i.categoryName ? ` (קטגוריה: ${i.categoryName})` : ''}`
                : `נמצא ב"מידע כללי" — ב‑Note עם תוכן תואם`;
            return `${idx + 1}. ${where}.\nתמצית: ${clean || 'אין תמצית זמינה.'}`;
          })
          .join('\n\n')
      : 'לא מצאתי מידע רלוונטי במערכת.';

  res.json({ answer });
});

// Tools (links or HTML files)
const writeToolFile = async (fileName, content) => {
  const fullPath = path.join(TOOLS_DIR, fileName);
  await fs.promises.writeFile(fullPath, content || '', 'utf-8');
  return `/ntools/${fileName}`;
};

const deleteToolFile = async (fileName) => {
  if (!fileName) return;
  const fullPath = path.join(TOOLS_DIR, fileName);
  try {
    await fs.promises.unlink(fullPath);
  } catch {
    /* ignore */
  }
};

const shapeTool = (tool) => ({
  ...tool,
  url: tool.target,
});

app.get('/api/tools', async (req, res) => {
  const { search = '' } = req.query;
  let tools = await prisma.tool.findMany({ orderBy: { createdAt: 'desc' } });
  if (search) {
    const term = search.toString().toLowerCase();
    tools = tools.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        (t.summary || '').toLowerCase().includes(term)
    );
  }
  res.json(tools.map(shapeTool));
});

app.get('/api/tools/:id', async (req, res) => {
  const { id } = req.params;
  const tool = await prisma.tool.findUnique({ where: { id } });
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  let htmlContent = '';
  if (tool.kind === 'html' && tool.fileName) {
    try {
      htmlContent = await fs.promises.readFile(path.join(TOOLS_DIR, tool.fileName), 'utf-8');
    } catch {
      htmlContent = '';
    }
  }
  res.json({ ...shapeTool(tool), htmlContent });
});

app.post('/api/tools', async (req, res) => {
  const { name, summary = '', kind, link = '', html = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!['link', 'html'].includes(kind)) return res.status(400).json({ error: 'kind must be link or html' });

  try {
    let target = '';
    let fileName = null;
    if (kind === 'link') {
      if (!link) return res.status(400).json({ error: 'Link is required' });
      target = link;
    } else {
      if (!html) return res.status(400).json({ error: 'HTML content is required' });
      fileName = `${nanoid()}.html`;
      target = await writeToolFile(fileName, html);
    }

    const tool = await prisma.tool.create({
      data: { name, summary, kind, target, fileName },
    });
    res.status(201).json(shapeTool(tool));
  } catch (e) {
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

app.put('/api/tools/:id', async (req, res) => {
  const { id } = req.params;
  const { name, summary = '', kind, link = '', html = '' } = req.body;
  const existing = await prisma.tool.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Tool not found' });
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!['link', 'html'].includes(kind)) return res.status(400).json({ error: 'kind must be link or html' });

  try {
    let target = existing.target;
    let fileName = existing.fileName;

    if (kind === 'link') {
      if (!link) return res.status(400).json({ error: 'Link is required' });
      target = link;
      if (existing.kind === 'html' && existing.fileName) {
        await deleteToolFile(existing.fileName);
        fileName = null;
      }
    } else {
      if (!html) return res.status(400).json({ error: 'HTML content is required' });
      if (!fileName) fileName = `${nanoid()}.html`;
      target = await writeToolFile(fileName, html);
    }

    const tool = await prisma.tool.update({
      where: { id },
      data: { name, summary, kind, target, fileName },
    });
    res.json(shapeTool(tool));
  } catch {
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

app.delete('/api/tools/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const tool = await prisma.tool.delete({ where: { id } });
    if (tool.kind === 'html' && tool.fileName) {
      await deleteToolFile(tool.fileName);
    }
    res.sendStatus(204);
  } catch {
    res.status(404).json({ error: 'Tool not found' });
  }
});

// Tasks
app.get('/api/tasks', async (req, res) => {
  const { search = '', userId, status, startDate, endDate } = req.query;

  const where = {
    ...(userId ? { userId } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  let tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  if (startDate) {
    tasks = tasks.filter((t) => (t.startDate ? dayjs(t.startDate).isAfter(dayjs(startDate).subtract(1, 'day')) : false));
  }
  if (endDate) {
    tasks = tasks.filter((t) => (t.endDate ? dayjs(t.endDate).isBefore(dayjs(endDate).add(1, 'day')) : false));
  }

  tasks = tasks.map(augmentTask);

  res.json(tasks);
});

app.post('/api/tasks', async (req, res) => {
  const { title, startDate, endDate, content, userId, templateId, steps = [], flag } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  let taskSteps = steps;
  if (!steps.length && templateId) {
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (template?.steps) {
      taskSteps = template.steps.map((s) => ({ ...s, completed: false, link: s.link || '', id: s.id || nanoid() }));
    }
  }

  const normalizedSteps = ensureStepShape(taskSteps);
  const progress = computeProgress(normalizedSteps);
  const status = deriveStatus(progress);

  const task = await prisma.task.create({
    data: {
      title,
      startDate: startDate || '',
      endDate: endDate || '',
      content: content || '',
      userId: userId || null,
      templateId: templateId || null,
      steps: normalizedSteps,
      flag: Boolean(flag),
      progress,
      status,
    },
  });

  res.status(201).json(augmentTask(task));
});

app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, startDate, endDate, content, userId, steps = [], templateId, flag } = req.body;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const updatedSteps = steps.length ? ensureStepShape(steps) : ensureStepShape(existing.steps || []);
  const progress = computeProgress(updatedSteps);
  const status = deriveStatus(progress);

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: title ?? existing.title,
      startDate: startDate ?? existing.startDate,
      endDate: endDate ?? existing.endDate,
      content: content ?? existing.content,
      userId: userId ?? existing.userId,
      templateId: templateId ?? existing.templateId,
      flag: flag !== undefined ? Boolean(flag) : existing.flag,
      steps: updatedSteps,
      progress,
      status,
    },
  });

  res.json(augmentTask(task));
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.task.delete({ where: { id } });
  } catch {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.sendStatus(204);
});

app.post('/api/tasks/:id/clone', async (req, res) => {
  const { id } = req.params;
  const original = await prisma.task.findUnique({ where: { id } });
  if (!original) return res.status(404).json({ error: 'Task not found' });

  const clonedSteps = ensureStepShape(original.steps || []).map((s) => ({ ...s, completed: false, id: nanoid() }));
  const progress = computeProgress(clonedSteps);
  const status = deriveStatus(progress);

  const clone = await prisma.task.create({
    data: {
      title: `${original.title} (העתק)`,
      startDate: original.startDate,
      endDate: original.endDate,
      content: original.content,
      userId: original.userId,
      templateId: original.templateId,
      flag: Boolean(original.flag),
      steps: clonedSteps,
      progress,
      status,
    },
  });

  res.status(201).json(augmentTask(clone));
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
