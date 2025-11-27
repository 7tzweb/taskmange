import express from 'express';
import cors from 'cors';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, 'db.json');
const defaultData = { users: [], templates: [], tasks: [] };

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, defaultData);

await db.read();
db.data = db.data || defaultData;
await db.write();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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
  const progress = computeProgress(task.steps);
  const status = deriveStatus(progress);
  return { ...task, progress, status };
};

const persist = async () => db.write();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Users
app.get('/api/users', (_req, res) => {
  res.json(db.data.users);
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const user = { id: nanoid(), name, email: email || '' };
  db.data.users.push(user);
  persist();
  res.status(201).json(user);
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const user = db.data.users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.name = name ?? user.name;
  user.email = email ?? user.email;
  persist();
  res.json(user);
});

// Templates
app.get('/api/templates', (_req, res) => {
  res.json(db.data.templates);
});

app.post('/api/templates', (req, res) => {
  const { name, steps = [], defaultStartDate, defaultEndDate } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name is required' });
  const normalizedSteps = steps.map((s) => ({
    id: s.id || nanoid(),
    title: s.title || '',
    link: s.link || '',
  }));
  const template = {
    id: nanoid(),
    name,
    steps: normalizedSteps,
    defaultStartDate: defaultStartDate || '',
    defaultEndDate: defaultEndDate || '',
    createdAt: new Date().toISOString(),
  };
  db.data.templates.push(template);
  persist();
  res.status(201).json(template);
});

app.put('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const { name, steps = [], defaultStartDate, defaultEndDate } = req.body;
  const template = db.data.templates.find((t) => t.id === id);
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
  persist();
  res.json(template);
});

app.delete('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const idx = db.data.templates.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Template not found' });
  db.data.templates.splice(idx, 1);
  persist();
  res.sendStatus(204);
});

// Tasks
app.get('/api/tasks', (req, res) => {
  const { search = '', userId, status, startDate, endDate } = req.query;
  const text = search.toLowerCase();

  let tasks = db.data.tasks.map(augmentTask);

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

app.post('/api/tasks', (req, res) => {
  const { title, startDate, endDate, content, userId, templateId, steps = [], flag } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  let taskSteps = steps;
  if (!steps.length && templateId) {
    const template = db.data.templates.find((t) => t.id === templateId);
    if (template) {
      taskSteps = template.steps.map((s) => ({ ...s, completed: false, link: s.link || '' }));
    }
  }

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

  db.data.tasks.push(task);
  persist();
  res.status(201).json(augmentTask(task));
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const task = db.data.tasks.find((t) => t.id === id);
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
  persist();
  res.json(augmentTask(task));
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const idx = db.data.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });
  db.data.tasks.splice(idx, 1);
  persist();
  res.sendStatus(204);
});

app.post('/api/tasks/:id/clone', (req, res) => {
  const { id } = req.params;
  const original = db.data.tasks.find((t) => t.id === id);
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
  db.data.tasks.push(clone);
  persist();
  res.status(201).json(augmentTask(clone));
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
