import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './prisma.js';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'db.json');

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

const ensureStepShape = (steps = []) =>
  steps.map((s) => ({
    id: s.id || nanoid(),
    title: s.title || '',
    link: s.link || '',
    completed: Boolean(s.completed),
  }));

async function importData() {
  if (!fs.existsSync(dbPath)) {
    console.error('db.json not found at', dbPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dbPath, 'utf-8');
  const data = JSON.parse(raw);

  // Users
  for (const user of data.users || []) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        name: user.name,
        email: user.email || '',
      },
      create: {
        id: user.id,
        name: user.name,
        email: user.email || '',
      },
    });
  }

  // Categories
  for (const cat of data.categories || []) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { name: cat.name },
      create: {
        id: cat.id,
        name: cat.name,
      },
    });
  }

  // Notes
  for (const note of data.notes || []) {
    await prisma.note.upsert({
      where: { id: note.id },
      update: {
        title: note.title || '',
        content: note.content || '',
      },
      create: {
        id: note.id,
        title: note.title || '',
        content: note.content || '',
        createdAt: note.createdAt ? new Date(note.createdAt) : undefined,
        updatedAt: note.updatedAt ? new Date(note.updatedAt) : undefined,
      },
    });
  }

  // Templates
  for (const tpl of data.templates || []) {
    const normalizedSteps = (tpl.steps || []).map((s) => ({
      id: s.id || nanoid(),
      title: s.title || '',
      link: s.link || '',
    }));
    await prisma.template.upsert({
      where: { id: tpl.id },
      update: {
        name: tpl.name,
        steps: normalizedSteps,
        defaultStartDate: tpl.defaultStartDate || '',
        defaultEndDate: tpl.defaultEndDate || '',
      },
      create: {
        id: tpl.id,
        name: tpl.name,
        steps: normalizedSteps,
        defaultStartDate: tpl.defaultStartDate || '',
        defaultEndDate: tpl.defaultEndDate || '',
        createdAt: tpl.createdAt ? new Date(tpl.createdAt) : undefined,
        updatedAt: tpl.updatedAt ? new Date(tpl.updatedAt) : undefined,
      },
    });
  }

  // Guides
  for (const guide of data.guides || []) {
    await prisma.guide.upsert({
      where: { id: guide.id },
      update: {
        title: guide.title,
        content: guide.content || '',
        categoryId: guide.categoryId || null,
      },
      create: {
        id: guide.id,
        title: guide.title,
        content: guide.content || '',
        categoryId: guide.categoryId || null,
        createdAt: guide.createdAt ? new Date(guide.createdAt) : undefined,
        updatedAt: guide.updatedAt ? new Date(guide.updatedAt) : undefined,
      },
    });
  }

  // Tasks
  for (const task of data.tasks || []) {
    const normalizedSteps = ensureStepShape(task.steps || []);
    const progress = computeProgress(normalizedSteps);
    const status = deriveStatus(progress);
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        startDate: task.startDate || '',
        endDate: task.endDate || '',
        content: task.content || '',
        userId: task.userId || null,
        templateId: task.templateId || null,
        steps: normalizedSteps,
        flag: Boolean(task.flag),
        progress,
        status,
      },
      create: {
        id: task.id,
        title: task.title,
        startDate: task.startDate || '',
        endDate: task.endDate || '',
        content: task.content || '',
        userId: task.userId || null,
        templateId: task.templateId || null,
        steps: normalizedSteps,
        flag: Boolean(task.flag),
        progress,
        status,
        createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : undefined,
      },
    });
  }

  console.log('Import completed');
}

importData()
  .catch((e) => {
    console.error('Import failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
