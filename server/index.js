import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { createClient } from 'redis';
import prisma from './prisma.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const stripHtml = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

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

// Bot (search in guides + notes)
app.post('/api/bot', async (req, res) => {
  const { question = '' } = req.body;
  const text = question.toLowerCase();
  const [notes, guides] = await Promise.all([
    prisma.note.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.guide.findMany({ include: { category: true }, orderBy: { updatedAt: 'desc' } }),
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
