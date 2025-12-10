// @ts-nocheck
import express from 'express';
import { nanoid } from 'nanoid';
import { createClient } from 'redis';
import { prisma } from '../services/db.js';
import { buildRag } from '../services/rag.js';
import { runChatCompletion } from '../services/ai.js';
import { rebuildEmbeddings } from '../services/embeddings.js';
import { normalizeWhitespace, sanitizeHebrew } from '../utils/textCleaning.js';

const router = express.Router();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = createClient({ url: redisUrl });
let redisReady = false;
redis
  .connect()
  .then(() => {
    redisReady = true;
    console.log('Chat redis memory connected');
  })
  .catch((err) => {
    console.error('Chat redis not available', err);
  });

const cacheHistory = async (sessionId: string, messages: any[]) => {
  if (!redisReady) return;
  try {
    await redis.setEx(`chat:session:${sessionId}`, 3600, JSON.stringify(messages.slice(-12)));
  } catch {
    /* ignore redis errors */
  }
};

const getCachedHistory = async (sessionId: string) => {
  if (!redisReady) return null;
  try {
    const raw = await redis.get(`chat:session:${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const ensureSession = async (sessionId?: string, titleHint?: string) => {
  if (sessionId) {
    const existing = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (existing) return existing;
  }
  const fallbackTitle = titleHint?.slice(0, 60) || 'שיחה חדשה';
  return prisma.chatSession.create({
    data: {
      id: sessionId || nanoid(),
      title: fallbackTitle,
    },
  });
};

const persistMessage = async (sessionId: string, role: 'user' | 'assistant', content: string, metadata: any = null) =>
  prisma.chatMessage.create({
    data: {
      sessionId,
      role,
      content,
      metadata,
    },
  });

const buildFallbackAnswer = (rag: Awaited<ReturnType<typeof buildRag>>) => {
  const contextSnippets = (rag.context || [])
    .slice(0, 4)
    .map((c) => `• ${c.title} (${c.source}): ${normalizeWhitespace(c.content).slice(0, 200)}`);

  const webSnippets = (rag.webResults || [])
    .slice(0, 2)
    .map((r) => `• ${r.title}: ${normalizeWhitespace(r.snippet || '').slice(0, 160)}`);

  const bullets = [...contextSnippets, ...webSnippets].filter(Boolean);
  if (!bullets.length) {
    return 'לא מצאתי מידע רלוונטי עדיין. נסה לנסח אחרת או להוסיף פרטים.';
  }

  return [
    'מצאתי מידע קשור במערכת:',
    ...bullets,
    'אם תרצה שאנסה מודל נוסף, שלח את השאלה שוב בעוד כמה רגעים.',
  ].join('\n');
};

const stripForeign = (text = '') =>
  text
    // remove Latin, Cyrillic, Arabic, Chinese/Japanese/Korean blocks
    .replace(/[A-Za-z\u0400-\u052F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u4E00-\u9FFF]+/g, '')
    .trim();

const forceHebrewAnswer = (answer: string, rag: Awaited<ReturnType<typeof buildRag>>) => {
  const sanitized = sanitizeHebrew(answer || '');
  const clean = stripForeign(normalizeWhitespace(sanitized));
  const hasHebrew = /[א-ת]/.test(clean);
  if (hasHebrew && clean.length > 1) return clean;
  if (!hasHebrew && clean && /\d/.test(clean)) return `הערך הוא ${clean}`;

  const tableChunk = (rag.context || []).find((c) => c.source === 'table');
  if (tableChunk) {
    return `על בסיס המידע הקיים: ${normalizeWhitespace(tableChunk.content)}`;
  }

  const fallback = buildFallbackAnswer(rag);
  const sanitizedFallback = stripForeign(normalizeWhitespace(fallback));
  const fallbackHasHebrew = /[א-ת]/.test(sanitizedFallback);
  if (fallbackHasHebrew && sanitizedFallback.length > 1) return sanitizedFallback;

  return 'לא הצלחתי לנסח תשובה בעברית על סמך המידע הקיים.';
};

const isTableQuestion = (q = '') => q.toLowerCase().includes('טבלה');

const buildTableText = (table: any, rows: any[], columns: any[]) => {
  const safeCols = columns.map((c: string, idx: number) => sanitizeHebrew(c) || `עמודה ${idx + 1}`);
  const header = `בטבלה "${sanitizeHebrew(table.name || 'ללא שם')}" יש ${rows.length} שורות ו-${safeCols.length} עמודות: ${safeCols.join(', ') || '—'}.`;
  const body = rows
    .slice(0, 5)
    .map((r: any, idx: number) => {
      const cells = safeCols.map((c: string, cIdx: number) => `${c}: ${sanitizeHebrew(String(r?.[cIdx] ?? '—'))}`);
      return `${idx + 1}. ${cells.join(' | ')}`;
    })
    .join('\n');
  return `${header}\n${body}`;
};

const detectMaxScore = (columns: string[], rows: any[]) => {
  const idx = columns.findIndex((c) => /ציון|score|ניקוד/i.test(c || ''));
  if (idx === -1) return null;
  let bestVal = -Infinity;
  let bestRow: any[] | null = null;
  rows.forEach((r) => {
    const raw = Array.isArray(r) ? r[idx] : null;
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    if (num > bestVal) {
      bestVal = num;
      bestRow = r;
    }
  });
  if (!bestRow || !Number.isFinite(bestVal)) return null;
  const nameIdx = columns.findIndex((c) => /שם|name/i.test(c || ''));
  const name = nameIdx >= 0 ? bestRow[nameIdx] : '';
  return `הציון הגבוה ביותר הוא ${bestVal}${name ? ` של ${name}` : ''}. (עמודה: ${columns[idx]})`;
};

const maybeAnswerFromTables = async (question: string) => {
  if (!isTableQuestion(question)) return null;
  const tables = await prisma.dataTable.findMany({ orderBy: { updatedAt: 'desc' }, take: 5 });
  if (!tables.length) return null;
  const lower = question.toLowerCase();
  const matched =
    tables.find((t) => (t.name || '').toLowerCase().includes('דוגמא')) ||
    tables.find((t) => (t.name || '').toLowerCase().includes('example')) ||
    tables.find((t) => (t.name || '').toLowerCase().includes(lower)) ||
    tables[0];

  const columns = Array.isArray(matched.columns) ? matched.columns : [];
  const rows = Array.isArray(matched.rows) ? matched.rows : [];

  if (/(הכי גבוה|גבוה ביותר|max|maximum|highest)/.test(question)) {
    const top = detectMaxScore(columns, rows);
    if (top) return top;
  }

  return buildTableText(matched, rows, columns);
};

router.get('/ai/health', async (_req, res) => {
  const db = await prisma.$queryRaw`SELECT 1`;
  res.json({
    ok: true,
    db: Boolean(db),
    redis: redisReady,
  });
});

router.post('/embeddings/rebuild', async (_req, res) => {
  try {
    await rebuildEmbeddings();
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to rebuild embeddings', err);
    res.status(500).json({ error: 'Failed to rebuild embeddings' });
  }
});

router.get('/chat/sessions', async (_req, res) => {
  const sessions = await prisma.chatSession.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  res.json(
    sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      lastMessage: s.messages?.[0]?.content || '',
    }))
  );
});

router.get('/chat/:id/messages', async (req, res) => {
  const { id } = req.params;
  const cached = await getCachedHistory(id);
  if (cached) return res.json(cached);

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: 'asc' },
  });
  await cacheHistory(id, messages);
  res.json(messages);
});

router.post('/chat', async (req, res) => {
  try {
    const { question, sessionId } = req.body;
    if (!question || !question.toString().trim()) return res.status(400).json({ error: 'question is required' });
    const cleanQuestion = normalizeWhitespace(question.toString());

    const session = await ensureSession(sessionId, cleanQuestion);
    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 12,
    });

    const shortHistory = history.slice(-6).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const rag = await buildRag(cleanQuestion, shortHistory);

    const tableAnswer = await maybeAnswerFromTables(cleanQuestion);

    let answer = tableAnswer || '';
    if (!answer) {
      try {
        answer = await runChatCompletion({ system: rag.prompt.system, userPrompt: rag.prompt.userPrompt });
      } catch (err) {
        console.error('AI provider unavailable, using fallback answer', err);
        answer = buildFallbackAnswer(rag);
      }
    }
    answer = forceHebrewAnswer(answer, rag);

    await Promise.all([
      persistMessage(session.id, 'user', cleanQuestion),
      persistMessage(session.id, 'assistant', answer, {
        context: rag.context,
        webResults: rag.webResults,
      }),
      prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date(), title: session.title || cleanQuestion.slice(0, 60) },
      }),
    ]);

    const updatedHistory = [...history, { role: 'user', content: cleanQuestion }, { role: 'assistant', content: answer }];
    await cacheHistory(session.id, updatedHistory);

    res.json({
      answer,
      sessionId: session.id,
      context: rag.context,
      webResults: rag.webResults,
    });
  } catch (err) {
    console.error('Chat pipeline failed', err);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

router.delete('/chat/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.chatSession.delete({ where: { id } });
    if (redisReady) {
      await redis.del(`chat:session:${id}`);
    }
    res.sendStatus(204);
  } catch (err) {
    res.status(404).json({ error: 'Session not found' });
  }
});

export default router;
