import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import dayjs from 'dayjs';
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = createClient({ url: redisUrl, socket: { reconnectStrategy: () => false } });
let redisReady = false;
const memoryStore = { users: [], templates: [], tasks: [] };

redis.on('error', (err) => {
  console.error('Redis error', err);
});

try {
  await redis.connect();
  redisReady = true;
} catch (err) {
  console.error('Redis connection failed, falling back to in-memory store', err);
  redisReady = false;
}

const KEYS = {
  users: 'users',
  templates: 'templates',
  tasks: 'tasks',
  categories: 'categories',
  guides: 'guides',
};

const ensureCollections = async () => {
  if (!redisReady) return;
  await Promise.all(
    Object.values(KEYS).map(async (key) => {
      const exists = await redis.exists(key);
      if (!exists) {
        await redis.set(key, '[]');
      }
    })
  );
};

const readList = async (key) => {
  if (redisReady) {
    const raw = await redis.get(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return memoryStore[key] || [];
};

const writeList = async (key, list) => {
  if (redisReady) {
    await redis.set(key, JSON.stringify(list));
  } else {
    memoryStore[key] = list;
  }
};

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

await ensureCollections();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, redis: redisReady ? 'connected' : 'memory' });
});

// Users
app.get('/api/users', (_req, res) => {
  readList(KEYS.users).then((users) => res.json(users));
});

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const user = { id: nanoid(), name, email: email || '' };
  const users = await readList(KEYS.users);
  users.push(user);
  await writeList(KEYS.users, users);
  res.status(201).json(user);
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const users = await readList(KEYS.users);
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.name = name ?? user.name;
  user.email = email ?? user.email;
  await writeList(KEYS.users, users);
  res.json(user);
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const users = await readList(KEYS.users);
  const idx = users.findIndex((u) => u.id === id);
  if (idx !== -1) {
    users.splice(idx, 1);
    await writeList(KEYS.users, users);
    // Unassign tasks from this user to avoid dangling references
    const tasks = await readList(KEYS.tasks);
    const updatedTasks = tasks.map((t) => (t.userId === id ? { ...t, userId: '' } : t));
    await writeList(KEYS.tasks, updatedTasks);
  }
  // Even if not found, respond 204 to avoid client-side errors from stale IDs
  res.sendStatus(204);
});

// Templates
app.get('/api/templates', (_req, res) => {
  readList(KEYS.templates).then((templates) => res.json(templates));
});

app.post('/api/templates', async (req, res) => {
  const { name, steps = [], defaultStartDate, defaultEndDate } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name is required' });
  const normalizedSteps = steps.map((s) => ({
    id: s.id || nanoid(),
    title: s.title || '',
    link: s.link || '',
  }));
  const templates = await readList(KEYS.templates);
  const template = {
    id: nanoid(),
    name,
    steps: normalizedSteps,
    defaultStartDate: defaultStartDate || '',
    defaultEndDate: defaultEndDate || '',
    createdAt: new Date().toISOString(),
  };
  templates.push(template);
  await writeList(KEYS.templates, templates);
  res.status(201).json(template);
});

app.put('/api/templates/:id', async (req, res) => {
  const { id } = req.params;
  const { name, steps = [], defaultStartDate, defaultEndDate } = req.body;
  const templates = await readList(KEYS.templates);
  const template = templates.find((t) => t.id === id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  template.name = name ?? template.name;
  template.defaultStartDate = defaultStartDate ?? template.defaultStartDate;
  template.defaultEndDate = defaultEndDate ?? template.defaultEndDate;
  template.steps = steps.map((s) => ({
    id: s.id || nanoid(),
    title: s.title || '',
    link: s.link || '',
  }));
  template.updatedAt = new Date().toISOString();
  await writeList(KEYS.templates, templates);
  res.json(template);
});

app.delete('/api/templates/:id', async (req, res) => {
  const { id } = req.params;
  const templates = await readList(KEYS.templates);
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Template not found' });
  templates.splice(idx, 1);
  await writeList(KEYS.templates, templates);
  res.sendStatus(204);
});

// Categories (Guides)
app.get('/api/categories', async (_req, res) => {
  const data = await readList(KEYS.categories);
  res.json(data);
});

app.post('/api/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  const categories = await readList(KEYS.categories);
  const exists = categories.find((c) => c.name === name);
  if (exists) return res.status(409).json({ error: 'Category already exists' });
  const cat = { id: nanoid(), name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  categories.push(cat);
  await writeList(KEYS.categories, categories);
  res.status(201).json(cat);
});

app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const categories = await readList(KEYS.categories);
  const cat = categories.find((c) => c.id === id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  cat.name = name ?? cat.name;
  cat.updatedAt = new Date().toISOString();
  await writeList(KEYS.categories, categories);
  res.json(cat);
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const categories = await readList(KEYS.categories);
  const idx = categories.findIndex((c) => c.id === id);
  if (idx !== -1) {
    categories.splice(idx, 1);
    await writeList(KEYS.categories, categories);
    // clear category from guides
    const guides = await readList(KEYS.guides);
    const updatedGuides = guides.map((g) => (g.categoryId === id ? { ...g, categoryId: '' } : g));
    await writeList(KEYS.guides, updatedGuides);
  }
  res.sendStatus(204);
});

// Guides
app.get('/api/guides', async (req, res) => {
  const { search = '' } = req.query;
  const text = search.toLowerCase();
  const [guides, categories] = await Promise.all([readList(KEYS.guides), readList(KEYS.categories)]);

  const categoriesMap = categories.reduce((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {});

  let result = guides.map((g) => ({
    ...g,
    categoryName: categoriesMap[g.categoryId] || 'ללא קטגוריה',
  }));

  if (text) {
    result = result.filter(
      (g) =>
        g.title.toLowerCase().includes(text) ||
        (g.categoryName || '').toLowerCase().includes(text) ||
        (g.content || '').toLowerCase().includes(text)
    );
  }

  res.json(result);
});

app.post('/api/guides', async (req, res) => {
  const { title, categoryId = '', content = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const guides = await readList(KEYS.guides);
  const guide = {
    id: nanoid(),
    title,
    categoryId,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  guides.push(guide);
  await writeList(KEYS.guides, guides);
  res.status(201).json(guide);
});

app.put('/api/guides/:id', async (req, res) => {
  const { id } = req.params;
  const { title, categoryId, content } = req.body;
  const guides = await readList(KEYS.guides);
  const guide = guides.find((g) => g.id === id);
  if (!guide) return res.status(404).json({ error: 'Guide not found' });
  guide.title = title ?? guide.title;
  guide.categoryId = categoryId ?? guide.categoryId;
  guide.content = content ?? guide.content;
  guide.updatedAt = new Date().toISOString();
  await writeList(KEYS.guides, guides);
  res.json(guide);
});

app.delete('/api/guides/:id', async (req, res) => {
  const { id } = req.params;
  const guides = await readList(KEYS.guides);
  const idx = guides.findIndex((g) => g.id === id);
  if (idx !== -1) {
    guides.splice(idx, 1);
    await writeList(KEYS.guides, guides);
  }
  res.sendStatus(204);
});

// Tasks
app.get('/api/tasks', async (req, res) => {
  const { search = '', userId, status, startDate, endDate } = req.query;
  const text = search.toLowerCase();

  let tasks = (await readList(KEYS.tasks)).map(augmentTask);

  if (text) {
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(text) ||
        (t.content || '').toLowerCase().includes(text)
    );
  }

  if (userId) {
    tasks = tasks.filter((t) => t.userId === userId);
  }

  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  if (startDate) {
    tasks = tasks.filter((t) => dayjs(t.startDate).isAfter(dayjs(startDate).subtract(1, 'day')));
  }

  if (endDate) {
    tasks = tasks.filter((t) => dayjs(t.endDate).isBefore(dayjs(endDate).add(1, 'day')));
  }

  res.json(tasks);
});

app.post('/api/tasks', async (req, res) => {
  const { title, startDate, endDate, content, userId, templateId, steps = [], flag } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  let taskSteps = steps;
  if (!steps.length && templateId) {
    const templates = await readList(KEYS.templates);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      taskSteps = template.steps.map((s) => ({ ...s, completed: false, link: s.link || '' }));
    }
  }

  const tasks = await readList(KEYS.tasks);
  const task = {
    id: nanoid(),
    title,
    startDate: startDate || '',
    endDate: endDate || '',
    content: content || '',
    userId: userId || '',
    templateId: templateId || '',
    flag: Boolean(flag),
    steps: taskSteps.map((s) => ({
      id: s.id || nanoid(),
      title: s.title || '',
      link: s.link || '',
      completed: Boolean(s.completed),
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tasks.push(task);
  await writeList(KEYS.tasks, tasks);
  res.status(201).json(augmentTask(task));
});

app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const tasks = await readList(KEYS.tasks);
  const task = tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { title, startDate, endDate, content, userId, steps = [], templateId, flag } = req.body;
  task.title = title ?? task.title;
  task.startDate = startDate ?? task.startDate;
  task.endDate = endDate ?? task.endDate;
  task.content = content ?? task.content;
  task.userId = userId ?? task.userId;
  task.templateId = templateId ?? task.templateId;
  if (flag !== undefined) {
    task.flag = Boolean(flag);
  }
  if (steps.length) {
    task.steps = steps.map((s) => ({
      id: s.id || nanoid(),
      title: s.title || '',
      link: s.link || '',
      completed: Boolean(s.completed),
    }));
  }
  task.updatedAt = new Date().toISOString();
  await writeList(KEYS.tasks, tasks);
  res.json(augmentTask(task));
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const tasks = await readList(KEYS.tasks);
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });
  tasks.splice(idx, 1);
  await writeList(KEYS.tasks, tasks);
  res.sendStatus(204);
});

app.post('/api/tasks/:id/clone', async (req, res) => {
  const { id } = req.params;
  const tasks = await readList(KEYS.tasks);
  const original = tasks.find((t) => t.id === id);
  if (!original) return res.status(404).json({ error: 'Task not found' });
  const clone = {
    ...original,
    id: nanoid(),
    title: `${original.title} (העתק)`,
    steps: original.steps.map((s) => ({ ...s, id: nanoid(), completed: false })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flag: Boolean(original.flag),
  };
  tasks.push(clone);
  await writeList(KEYS.tasks, tasks);
  res.status(201).json(augmentTask(clone));
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
