// @ts-nocheck
import { prisma } from './db.js';
import { searchSimilarEmbeddings } from './embeddings.js';
import { ContextChunk, WebResult, buildPrompt } from '../utils/promptBuilder.js';
import { normalizeWhitespace, sanitizeHebrew, stripHtml } from '../utils/textCleaning.js';

type RagResult = {
  prompt: { system: string; userPrompt: string };
  context: ContextChunk[];
  webResults: WebResult[];
};

const tableContainsTerm = (table: any, term = '') => {
  if (!term) return true;
  const searchTerms = term
    .toString()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (!searchTerms.length) return true;
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const haystack = [
    table.name || '',
    columns.join(' '),
    ...rows.map((row) => (Array.isArray(row) ? row.join(' ') : JSON.stringify(row || ''))),
  ]
    .join(' ')
    .toLowerCase();
  return searchTerms.some((t) => haystack.includes(t));
};

const summarizeTable = (table: any, maxRows = 8) => {
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const safeCols = columns.map((c: string, idx: number) => sanitizeHebrew(c) || `עמודה ${idx + 1}`);

  const formattedRows = rows
    .slice(0, maxRows)
    .map((r: any, idx: number) => {
      const safeRow = Array.isArray(r) ? r : [];
      const cells = safeCols.map((c, cIdx) => `${c}: ${sanitizeHebrew(String(safeRow[cIdx] ?? '—'))}`);
      return `${idx + 1}. ${cells.join(' | ')}`;
    })
    .join('\n');

  return normalizeWhitespace(
    `שם: ${sanitizeHebrew(table.name || 'טבלה')}
    עמודות (${safeCols.length}): ${safeCols.join(', ') || '—'}
    דגימת שורות (${rows.length} סה״כ):
    ${formattedRows || '—'}`
  );
};

const toChunk = (title: string, source: string, content: string): ContextChunk => ({
  title: sanitizeHebrew(title),
  source,
  content: sanitizeHebrew(normalizeWhitespace(content)),
});

const fetchInternal = async (question: string): Promise<ContextChunk[]> => {
  const term = question.slice(0, 120);
  const [notes, guides, tasks, tables] = await Promise.all([
    prisma.note.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { content: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    prisma.guide.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { content: { contains: term, mode: 'insensitive' } },
        ],
      },
      include: { category: true },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    prisma.task.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { content: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    prisma.dataTable.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
  ]);

  const chunks: ContextChunk[] = [];
  const relevantTables = tables.filter((t) => tableContainsTerm(t, term)).slice(0, 3);
  const fallbackTables = tables.slice(0, 2);
  const tablesToUse = relevantTables.length ? relevantTables : fallbackTables;

  tablesToUse.forEach((t) =>
    chunks.push(toChunk(t.name || 'טבלה', 'table', summarizeTable(t, 10)))
  );

  notes.slice(0, 5).forEach((n) =>
    chunks.push(
      toChunk(n.title || 'Note', 'note', `${stripHtml(n.content || '')}`)
    )
  );
  guides.slice(0, 5).forEach((g) =>
    chunks.push(
      toChunk(
        g.title || 'Guide',
        g.category?.name ? `guide · ${g.category.name}` : 'guide',
        stripHtml(g.content || '')
      )
    )
  );
  tasks.slice(0, 5).forEach((t) =>
    chunks.push(
      toChunk(
        t.title || 'Task',
        'task',
        `${stripHtml(t.content || '')}\nשלבים: ${(t.steps || [])
          .map((s: any, idx: number) => `${idx + 1}. ${s.title || ''}`)
          .join(' ')}`
      )
    )
  );

  return chunks;
};

export const buildRag = async (
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<RagResult> => {
  const [internal, embeddingHits] = await Promise.all([
    fetchInternal(question),
    searchSimilarEmbeddings(question, 3),
  ]);

  const contextFromEmbeddings: ContextChunk[] = embeddingHits.map((hit) =>
    toChunk(`${hit.entityType}#${hit.entityId}`, `vector · ${hit.entityType}`, hit.content)
  );

  // כיבוי חיפוש אינטרנט כדי להאיץ מענה ולמקד בנתוני המערכת
  const useWeb = false;
  const webResults = [];

  const combinedContext = [...internal, ...contextFromEmbeddings];
  const prompt = buildPrompt({
    question,
    history,
    context: combinedContext.slice(0, 6),
    webResults,
  });

  return {
    prompt,
    context: combinedContext,
    webResults,
  };
};
