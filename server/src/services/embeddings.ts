// @ts-nocheck
import { Ollama } from 'ollama';
import pgvector from 'pgvector/pg';
import { nanoid } from 'nanoid';
import { chunkText, stripHtml } from '../utils/textCleaning.js';
import { ensureVectorExtension, pool, prisma } from './db.js';

const { toSql } = pgvector as { toSql: (values: number[]) => unknown };
const DIMENSION_HINT = 0; // leave 0 to allow any length; set to known value if you want enforcement

export type EmbeddingRow = {
  id: number;
  entityType: string;
  entityId: string;
  content: string;
  score?: number;
};

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const ollamaClient = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

const ensureEmbeddingsTable = async () => {
  const ready = await ensureVectorExtension();
  if (!ready) return false;
  const vectorType = DIMENSION_HINT > 0 ? `vector(${DIMENSION_HINT})` : 'vector';
  await pool.query(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id SERIAL PRIMARY KEY,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding ${vectorType} NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS embeddings_entity_idx ON embeddings ("entityType", "entityId");`);
  await pool.query(`CREATE INDEX IF NOT EXISTS embeddings_created_idx ON embeddings ("createdAt");`);
  return true;
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const clean = stripHtml(text);
  try {
    const response = await ollamaClient.embeddings({
      model: EMBEDDING_MODEL,
      prompt: clean,
    });
    return response.embedding || response.data?.[0]?.embedding || [];
  } catch (err) {
    console.error('Failed to generate embedding', err);
    return [];
  }
};

const buildSourcePayloads = async (): Promise<{ entityType: string; entityId: string; content: string }[]> => {
  const [notes, guides, favorites, tasks, templates, tables] = await Promise.all([
    prisma.note.findMany(),
    prisma.guide.findMany({ include: { category: true } }),
    prisma.favorite.findMany(),
    prisma.task.findMany(),
    prisma.template.findMany(),
    prisma.dataTable.findMany(),
  ]);

  const rows: { entityType: string; entityId: string; content: string }[] = [];

  notes.forEach((n) =>
    rows.push({
      entityType: 'note',
      entityId: n.id,
      content: `${n.title || 'Note'}\n${n.content || ''}`,
    })
  );

  guides.forEach((g) =>
    rows.push({
      entityType: 'guide',
      entityId: g.id,
      content: `${g.title || 'Guide'}\nקטגוריה: ${g.category?.name || 'כללי'}\n${g.content || ''}`,
    })
  );

  favorites.forEach((f) =>
    rows.push({
      entityType: 'favorite',
      entityId: f.id,
      content: `${f.title || 'Favorite'}\n${f.link || ''}\n${f.content || ''}`,
    })
  );

  tasks.forEach((t) =>
    rows.push({
      entityType: 'task',
      entityId: t.id,
      content: `${t.title}\n${t.content || ''}\nשלבים: ${(t.steps || [])
        .map((s: any, idx: number) => `${idx + 1}. ${s.title || ''} ${s.link ? `(${s.link})` : ''}`)
        .join('\n')}`,
    })
  );

  templates.forEach((tpl) =>
    rows.push({
      entityType: 'template',
      entityId: tpl.id,
      content: `${tpl.name}\nשלבים מומלצים:\n${(tpl.steps || [])
        .map((s: any, idx: number) => `${idx + 1}. ${s.title || ''} ${s.link ? `(${s.link})` : ''}`)
        .join('\n')}`,
    })
  );

  tables.forEach((t) =>
    rows.push({
      entityType: 'table',
      entityId: t.id,
      content: `${t.name || 'טבלה'}\nעמודות: ${(t.columns || []).join(', ')}\nדגימה:\n${(t.rows || [])
        .slice(0, 5)
        .map((r: any, idx: number) => `${idx + 1}. ${Array.isArray(r) ? r.join(' | ') : ''}`)
        .join('\n')}`,
    })
  );

  return rows;
};

export const rebuildEmbeddings = async () => {
  const ready = await ensureEmbeddingsTable();
  if (!ready) {
    console.warn('Skipping embeddings rebuild because pgvector is unavailable');
    return;
  }
  await pool.query('TRUNCATE TABLE embeddings');

  const payloads = await buildSourcePayloads();
  for (const row of payloads) {
    const chunks = chunkText(row.content);
    for (const chunk of chunks) {
      const emb = await generateEmbedding(chunk);
      if (!emb?.length) continue;
      await pool.query(
        `INSERT INTO embeddings (entityType, entityId, content, embedding, createdAt)
         VALUES ($1, $2, $3, $4, NOW())`,
        [row.entityType, row.entityId, chunk, toSql(emb)]
      );
    }
  }
};

export const searchSimilarEmbeddings = async (query: string, limit = 5): Promise<EmbeddingRow[]> => {
  const ready = await ensureEmbeddingsTable();
  if (!ready) return [];
  const embedding = await generateEmbedding(query);
  if (!embedding?.length) return [];

  const result = await pool.query(
    `
      SELECT id, "entityType", "entityId", content, 1 - (embedding <=> $1::vector) as score
      FROM embeddings
      ORDER BY embedding <-> $1::vector
      LIMIT $2;
    `,
    [toSql(embedding), limit]
  );

  return result.rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    content: r.content,
    score: Number(r.score ?? 0),
  }));
};

export const addAdHocEmbedding = async (content: string) => {
  const ready = await ensureEmbeddingsTable();
  if (!ready) return null;
  const emb = await generateEmbedding(content);
  if (!emb?.length) return null;
  const entityId = nanoid();
  await pool.query(
    `INSERT INTO embeddings (entityType, entityId, content, embedding, createdAt)
     VALUES ($1, $2, $3, $4, NOW())`,
    ['adhoc', entityId, content, toSql(emb)]
  );
  return { entityId };
};
