import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DataGrid, { Column, FilterRow, HeaderFilter, Paging, SearchPanel } from 'devextreme-react/data-grid';
import RichTextEditor from '../../components/RichTextEditor.jsx';
import {
  askProBot,
  createNote,
  deleteNote,
  fetchNotes,
  updateNote,
  fetchTables,
  createTable,
  updateTable,
  deleteTable,
  fetchChatSessions,
  fetchChatHistory,
  deleteChatSession,
  rebuildEmbeddings,
} from '../../api.js';

const createEmptyNote = () => ({ id: '', title: '', content: '' });
const stripHtml = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const DEFAULT_GRID_SIZE = 10;
const createEmptyTable = () => {
  const columns = Array.from({ length: DEFAULT_GRID_SIZE }, (_v, i) => `עמודה ${i + 1}`);
  const rows = Array.from({ length: DEFAULT_GRID_SIZE }, () => Array(columns.length).fill(''));
  return { id: '', name: '', columns, rows };
};
const tableContainsTerm = (table, term = '') => {
  if (!term) return true;
  const search = term.toString().toLowerCase();
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const haystack = [
    table.name || '',
    columns.join(' '),
    ...rows.map((row) => (Array.isArray(row) ? row.join(' ') : JSON.stringify(row || ''))),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(search);
};
const buildGridData = (table) => {
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  const data = rows.map((row, idx) => {
    const safeRow = Array.isArray(row) ? row : [];
    const shaped = { __row: idx + 1 };
    columns.forEach((_, cIdx) => {
      shaped[`col_${cIdx}`] = safeRow[cIdx] ?? '';
    });
    return shaped;
  });
  return {
    columns: columns.map((col, idx) => ({ dataField: `col_${idx}`, caption: col || `עמודה ${idx + 1}` })),
    data,
  };
};

function InfoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('general');
  const [notes, setNotes] = useState([]);
  const [noteForm, setNoteForm] = useState(createEmptyNote());
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [botInput, setBotInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSteps, setChatSteps] = useState([]);
  const [chatProgress, setChatProgress] = useState(0);
  const [embeddingsBusy, setEmbeddingsBusy] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [viewNote, setViewNote] = useState(null);
  const [tables, setTables] = useState([]);
  const [tableForm, setTableForm] = useState(createEmptyTable());
  const [tableEditorOpen, setTableEditorOpen] = useState(false);
  const [tableSaving, setTableSaving] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [viewTable, setViewTable] = useState(null);

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'bot') {
      setTab('bot');
    } else if (urlTab === 'tables') {
      setTab('tables');
    } else {
      setTab('general');
    }
  }, [searchParams]);

  useEffect(() => {
    loadNotes();
    loadTables();
    loadChatSessions();
  }, []);

  const loadNotes = async () => {
    const data = await fetchNotes();
    setNotes(data);
  };
  const loadTables = async (term = '') => {
    const data = await fetchTables(term ? { search: term } : {});
    setTables(data);
  };
  const loadChatSessions = async (preferredSessionId = '') => {
    const data = await fetchChatSessions();
    setChatSessions(data);
    const candidate = preferredSessionId || activeSessionId || (data.length ? data[0].id : '');
    if (candidate && candidate !== activeSessionId) {
      selectSession(candidate);
    }
  };

  const filteredChatSessions = useMemo(() => {
    if (!chatSearch.trim()) return chatSessions;
    const term = chatSearch.toLowerCase();
    return chatSessions.filter(
      (s) =>
        (s.title || '').toLowerCase().includes(term) ||
        (s.lastMessage || '').toLowerCase().includes(term)
    );
  }, [chatSessions, chatSearch]);

  const loadChatHistory = async (sessionId) => {
    if (!sessionId) return;
    const data = await fetchChatHistory(sessionId);
    setChatMessages(data);
  };
  const selectSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    await loadChatHistory(sessionId);
  };

  const startNewChat = () => {
    setActiveSessionId('');
    setChatMessages([]);
  };

  const removeChatSession = async (id) => {
    if (!id) return;
    try {
      await deleteChatSession(id);
      if (activeSessionId === id) {
        setActiveSessionId('');
        setChatMessages([]);
      }
      await loadChatSessions();
    } catch (e) {
      /* ignore */
    }
  };

  const filteredNotes = useMemo(() => {
    if (!search) return notes;
    return notes.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (n.content || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [notes, search]);
  const filteredTables = useMemo(() => {
    if (!tableSearch) return tables;
    return tables.filter((t) => tableContainsTerm(t, tableSearch));
  }, [tables, tableSearch]);
  const viewTableGrid = useMemo(() => buildGridData(viewTable || {}), [viewTable]);

  const saveNote = async (e) => {
    e.preventDefault();
    if (!noteForm.title && !noteForm.content) return;
    const derivedTitle = stripHtml(noteForm.content).slice(0, 60) || 'ללא כותרת';
    const payload = { ...noteForm, title: derivedTitle };
    if (noteForm.id) {
      await updateNote(noteForm.id, payload);
    } else {
      await createNote(payload);
    }
    setNoteForm(createEmptyNote());
    setEditorOpen(false);
    loadNotes();
  };

  const editNote = (note) => {
    setNoteForm(note);
    setEditorOpen(true);
  };
  const removeNote = async (id) => {
    await deleteNote(id);
    if (noteForm.id === id) setNoteForm(createEmptyNote());
    loadNotes();
  };

  const saveTable = async (e) => {
    e.preventDefault();
    if (!tableForm.name.trim()) return;
    setTableSaving(true);
    const payload = {
      name: tableForm.name.trim(),
      columns: tableForm.columns,
      rows: tableForm.rows,
    };
    if (tableForm.id) {
      await updateTable(tableForm.id, payload);
    } else {
      await createTable(payload);
    }
    setTableForm(createEmptyTable());
    setTableEditorOpen(false);
    await loadTables(tableSearch);
    setTableSaving(false);
  };

  const editTable = (table) => {
    const fallback = createEmptyTable();
    const columns = Array.isArray(table.columns) && table.columns.length ? table.columns : fallback.columns;
    const rows = Array.isArray(table.rows) ? table.rows : fallback.rows;
    const paddedRows = rows.map((r) => {
      const base = Array.isArray(r) ? r : [];
      if (base.length < columns.length) return [...base, ...Array(columns.length - base.length).fill('')];
      if (base.length > columns.length) return base.slice(0, columns.length);
      return base;
    });
    setTableForm({
      id: table.id,
      name: table.name || '',
      columns,
      rows: paddedRows,
    });
    setTableEditorOpen(true);
  };

  const removeTable = async (id) => {
    await deleteTable(id);
    if (tableForm.id === id) {
      setTableForm(createEmptyTable());
      setTableEditorOpen(false);
    }
    loadTables(tableSearch);
  };

  const addColumn = () => {
    setTableForm((p) => {
      const nextColumns = [...p.columns, `עמודה ${p.columns.length + 1}`];
      const nextRows = p.rows.map((r) => [...r, '']);
      return { ...p, columns: nextColumns, rows: nextRows };
    });
  };

  const addRow = () => {
    setTableForm((p) => ({
      ...p,
      rows: [...p.rows, Array(p.columns.length).fill('')],
    }));
  };

  const removeColumnAt = (idx) => {
    setTableForm((p) => {
      if (p.columns.length <= 1) return p;
      const nextColumns = p.columns.filter((_, i) => i !== idx);
      const nextRows = p.rows.map((r) => r.filter((_, i) => i !== idx));
      return { ...p, columns: nextColumns, rows: nextRows };
    });
  };

  const removeLastColumn = () => {
    setTableForm((p) => {
      if (p.columns.length <= 1) return p;
      const nextColumns = p.columns.slice(0, -1);
      const nextRows = p.rows.map((r) => r.slice(0, nextColumns.length));
      return { ...p, columns: nextColumns, rows: nextRows };
    });
  };

  const removeLastRow = () => {
    setTableForm((p) => {
      if (p.rows.length <= 1) return p;
      return { ...p, rows: p.rows.slice(0, -1) };
    });
  };

  const removeRowAt = (idx) => {
    setTableForm((p) => {
      if (p.rows.length <= 1) return p;
      return { ...p, rows: p.rows.filter((_, i) => i !== idx) };
    });
  };

  const updateCell = (rowIdx, colIdx, value) => {
    setTableForm((p) => {
      const nextRows = p.rows.map((r, idx) => {
        if (idx !== rowIdx) return r;
        const rowCopy = [...r];
        rowCopy[colIdx] = value;
        return rowCopy;
      });
      return { ...p, rows: nextRows };
    });
  };

  const renameColumn = (idx, value) => {
    setTableForm((p) => {
      const nextColumns = [...p.columns];
      nextColumns[idx] = value;
      return { ...p, columns: nextColumns };
    });
  };

  const clearTable = () => {
    setTableForm((p) => ({
      ...createEmptyTable(),
      name: p.name,
    }));
  };

  const copyAsTsv = async () => {
    const header = tableForm.columns.join('\t');
    const lines = tableForm.rows.map((r) => tableForm.columns.map((_, i) => r[i] || '').join('\t'));
    const tsv = [header, ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      /* ignore */
    }
  };

  const pasteMatrix = (startRow, startCol, text) => {
    const clean = text.replace(/\r/g, '');
    const rows = clean.split('\n').filter((line, idx, arr) => line.length || idx < arr.length - 1);
    const matrix = rows.map((line) => line.split('\t'));
    const neededCols = Math.max(tableForm.columns.length, startCol + Math.max(...matrix.map((r) => r.length)));
    const neededRows = Math.max(tableForm.rows.length, startRow + matrix.length);

    setTableForm((p) => {
      const columns =
        p.columns.length >= neededCols
          ? p.columns
          : [...p.columns, ...Array.from({ length: neededCols - p.columns.length }, (_v, i) => `עמודה ${p.columns.length + i + 1}`)];
      const rowsArr =
        p.rows.length >= neededRows
          ? p.rows.map((r) => {
              const pad = columns.length - r.length;
              return pad > 0 ? [...r, ...Array(pad).fill('')] : r.slice(0, columns.length);
            })
          : [
              ...p.rows.map((r) => {
                const pad = columns.length - r.length;
                return pad > 0 ? [...r, ...Array(pad).fill('')] : r.slice(0, columns.length);
              }),
              ...Array.from({ length: neededRows - p.rows.length }, () => Array(columns.length).fill('')),
            ];

      matrix.forEach((mRow, rIdx) => {
        mRow.forEach((val, cIdx) => {
          const targetRow = startRow + rIdx;
          const targetCol = startCol + cIdx;
          rowsArr[targetRow][targetCol] = val;
        });
      });

      return { ...p, columns, rows: rowsArr };
    });
  };

  const sendChat = async (e) => {
    e.preventDefault();
    if (!botInput.trim()) return;
    const prompt = botInput.trim();
    setChatMessages((msgs) => [...msgs, { role: 'user', content: prompt }]);
    setBotInput('');
    setChatLoading(true);
    const stepsTemplate = [
      { key: 'context', label: 'מחפש הקשר פנימי', status: 'doing' },
      { key: 'prompt', label: 'מכין פרומפט', status: 'pending' },
      { key: 'model', label: 'מריץ מודל', status: 'pending' },
      { key: 'filter', label: 'מסנן תשובה לעברית', status: 'pending' },
    ];
    setChatSteps(stepsTemplate);
    setChatProgress(10);
    try {
      const res = await askProBot({ question: prompt, sessionId: activeSessionId || undefined });
      setChatSteps((s) =>
        s.map((step, idx) =>
          idx <= 2 ? { ...step, status: 'done' } : { ...step, status: 'doing' }
        )
      );
      setChatProgress(70);
      const assistantMsg = res.answer || 'לא הצלחתי לנסח תשובה כרגע.';
      if (res.sessionId && res.sessionId !== activeSessionId) {
        setActiveSessionId(res.sessionId);
      }
      setChatMessages((msgs) => [...msgs, { role: 'assistant', content: assistantMsg }]);
      loadChatSessions(res.sessionId || activeSessionId);
      setChatSteps((s) => s.map((step) => ({ ...step, status: 'done' })));
      setChatProgress(100);
    } catch (err) {
      setChatMessages((msgs) => [...msgs, { role: 'assistant', content: 'לא הצלחתי לענות כרגע, נסה שוב.' }]);
      setChatSteps((s) => s.map((step) => ({ ...step, status: 'error' })));
      setChatProgress(0);
    } finally {
      setChatLoading(false);
    }
  };

  const rebuildAllEmbeddings = async () => {
    setEmbeddingsBusy(true);
    try {
      await rebuildEmbeddings();
      await loadChatSessions();
    } catch (err) {
      console.error('Failed to rebuild embeddings', err);
      alert('שגיאה בבניית Embeddings. בדוק את השרת ונסה שוב.');
    } finally {
      setEmbeddingsBusy(false);
    }
  };

  const switchTab = (nextTab) => {
    setTab(nextTab);
    const params = new URLSearchParams();
    if (nextTab === 'bot') params.set('tab', 'bot');
    if (nextTab === 'tables') params.set('tab', 'tables');
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">מידע</p>
          <h2>מרכז מידע</h2>
          <p className="subtitle">סטיקי-נוטס עם עורך עשיר, טבלאות דינמיות, ובוט שמחפש במידע שנשמר.</p>
          <div className="tags">
            <span className="tag">Notes</span>
            <span className="tag">Tables</span>
            <span className="tag">AI Bot</span>
          </div>
        </div>
        <div className="actions inline-actions">
          <button
            type="button"
            className={tab === 'general' ? '' : 'ghost'}
            onClick={() => switchTab('general')}
          >
            מידע כללי
          </button>
          <button
            type="button"
            className={tab === 'tables' ? '' : 'ghost'}
            onClick={() => switchTab('tables')}
          >
            יצירת טבלאות
          </button>
          <button
            type="button"
            className={tab === 'bot' ? '' : 'ghost'}
            onClick={() => switchTab('bot')}
          >
            הבוט
          </button>
        </div>
      </section>

      {tab === 'general' && (
        <section className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Sticky Notes</p>
              <h3>מידע כללי</h3>
            </div>
            <input
              type="search"
              placeholder="חיפוש בכל הסטיקי-נוטס"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: '240px' }}
            />
          </div>

          <form className="stack" onSubmit={saveNote}>
            <div className="actions" style={{ gap: '8px', marginBottom: '8px' }}>
              <button type="button" onClick={() => setEditorOpen((v) => !v)}>
                {editorOpen ? 'סגור Note' : 'פתח Note'}
              </button>
              {editorOpen && (
                <>
                  <button type="submit">{noteForm.id ? 'שמור Note' : 'צור Note'}</button>
                  {noteForm.id && (
                    <button type="button" className="danger ghost" onClick={() => removeNote(noteForm.id)}>
                      מחק נוט
                    </button>
                  )}
                </>
              )}
            </div>

            {editorOpen && (
              <div className="form-grid">
                <div className="full">
                  <div className="editor-wrapper full">
                    <RichTextEditor value={noteForm.content} onChange={(val) => setNoteForm((p) => ({ ...p, content: val }))} />
                  </div>
                </div>
              </div>
            )}
          </form>

          <div className="notes-grid" style={{ marginTop: '12px' }}>
            {filteredNotes.map((n) => (
              <div key={n.id} className="note-card">
                <p className="muted small">
                  {new Date(n.updatedAt || n.createdAt || Date.now()).toLocaleString()}
                </p>
                <div
                  className="note-preview"
                  dangerouslySetInnerHTML={{ __html: n.content || '<em>אין תוכן</em>' }}
                />
                <div className="actions inline-actions">
                  <button type="button" className="ghost action-pill" onClick={() => setViewNote(n)} title="צפייה">
                    👁️
                  </button>
                  <button type="button" className="ghost action-pill" onClick={() => editNote(n)} title="עריכה">
                    ✏️
                  </button>
                  <button type="button" className="danger ghost action-pill" onClick={() => removeNote(n.id)} title="מחיקה">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
            {!filteredNotes.length && <p className="muted">אין נוטים עדיין.</p>}
          </div>
        </section>
      )}

      {tab === 'tables' && (
        <section className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">יצירת טבלאות</p>
              <h3>DataGrid</h3>
              <p className="muted small">בנה טבלה חופשית, הוסף עמודות/שורות ושמור לעריכה חוזרת. החיפוש מחפש גם בתוך תאי הטבלה.</p>
            </div>
            <input
              type="search"
              placeholder="חיפוש לפי שם או תוכן טבלה..."
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                loadTables(e.target.value);
              }}
              style={{ minWidth: '240px' }}
            />
          </div>

          <form className="stack" onSubmit={saveTable}>
            <div className="actions" style={{ gap: '8px', marginBottom: '8px' }}>
              <button type="button" onClick={() => setTableEditorOpen((v) => !v)}>
                {tableEditorOpen ? 'סגור יצירת טבלה' : 'פתח יצירת טבלה'}
              </button>
              {tableEditorOpen && (
                <>
                  <button type="submit" disabled={tableSaving}>
                    {tableSaving ? 'שומר...' : tableForm.id ? 'עדכן טבלה' : 'שמור טבלה'}
                  </button>
                  {tableForm.id && (
                    <button type="button" className="danger ghost" onClick={() => removeTable(tableForm.id)}>
                      מחק טבלה
                    </button>
                  )}
                </>
              )}
            </div>

            {tableEditorOpen && (
              <div className="stack" style={{ gap: '12px' }}>
                <div className="form-grid">
                  <label className="full">
                    שם טבלה
                    <input
                      type="text"
                      value={tableForm.name}
                      onChange={(e) => setTableForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="לדוגמה: טבלת מעקב"
                      required
                    />
                  </label>
                </div>

                <div className="actions inline-actions" style={{ gap: '8px' }}>
                  <button type="button" className="ghost" onClick={addColumn}>
                    הוסף עמודה
                  </button>
                  <button type="button" className="ghost" onClick={removeLastColumn}>
                    הורד עמודה
                  </button>
                  <button type="button" className="ghost" onClick={addRow}>
                    הוסף שורה
                  </button>
                  <button type="button" className="ghost" onClick={removeLastRow}>
                    הורד שורה
                  </button>
                  <button type="button" className="ghost" onClick={clearTable}>
                    נקה טבלה
                  </button>
                  <button type="button" className="ghost" onClick={copyAsTsv}>
                    העתק כ‑TSV
                  </button>
                  <span className="muted small">
                    {tableForm.columns.length} עמודות · {tableForm.rows.length} שורות
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr>
                        <th style={{ borderBottom: '1px solid var(--border)', padding: '6px', textAlign: 'center' }}>#</th>
                        {tableForm.columns.map((col, idx) => (
                          <th key={idx} style={{ borderBottom: '1px solid var(--border)', padding: '6px' }}>
                            <input
                              type="text"
                              value={col}
                              onChange={(e) => renameColumn(idx, e.target.value)}
                              style={{ width: '100%' }}
                            />
                            <button
                              type="button"
                              className="ghost small"
                              onClick={() => removeColumnAt(idx)}
                              style={{ marginTop: 4 }}
                              title="מחק עמודה זו"
                            >
                              ✕
                            </button>
                          </th>
                        ))}
                        <th style={{ borderBottom: '1px solid var(--border)', padding: '6px', textAlign: 'center' }}>פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableForm.rows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td style={{ borderBottom: '1px solid var(--border)', padding: '6px', textAlign: 'center' }}>
                            {rowIdx + 1}
                          </td>
                          {tableForm.columns.map((col, colIdx) => (
                            <td key={`${rowIdx}-${colIdx}`} style={{ borderBottom: '1px solid var(--border)', padding: '4px' }}>
                              <input
                                type="text"
                                value={(row && row[colIdx]) || ''}
                                onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  pasteMatrix(rowIdx, colIdx, e.clipboardData.getData('text'));
                                }}
                                style={{ width: '100%' }}
                              />
                            </td>
                          ))}
                          <td style={{ borderBottom: '1px solid var(--border)', padding: '6px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="ghost small danger"
                              onClick={() => removeRowAt(rowIdx)}
                              title="מחק שורה זו"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </form>

          <div className="notes-grid" style={{ marginTop: '12px' }}>
            {filteredTables.map((t) => (
              <div key={t.id} className="note-card">
                <p className="muted small">
                  {new Date(t.updatedAt || t.createdAt || Date.now()).toLocaleString()}
                </p>
                <h4>{t.name}</h4>
                <p className="muted small">
                  {(t.columns || []).length} עמודות · {(t.rows || []).length} שורות
                </p>
                <div className="actions inline-actions">
                  <button type="button" className="ghost action-pill" onClick={() => setViewTable(t)} title="צפייה">
                    👁️
                  </button>
                  <button type="button" className="ghost action-pill" onClick={() => editTable(t)} title="עריכה">
                    ✏️
                  </button>
                  <button type="button" className="danger ghost action-pill" onClick={() => removeTable(t.id)} title="מחיקה">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
            {!filteredTables.length && <p className="muted">אין טבלאות עדיין.</p>}
          </div>
        </section>
      )}

      {tab === 'bot' && (
        <section className="card bot-pro">
          <div className="card-head">
            <div>
              <p className="eyebrow">AI Bot · RAG</p>
              <h3>הבוט המקצועי</h3>
              <p className="muted small">חיבור למידע פנימי (pgvector) + חיפוש אינטרנט בזמן אמת + היסטוריית שיחות.</p>
            </div>
            <div className="actions inline-actions" style={{ gap: '8px' }}>
              <button type="button" onClick={startNewChat} className="ghost">
                שיחה חדשה
              </button>
              <button type="button" onClick={rebuildAllEmbeddings} disabled={embeddingsBusy}>
                {embeddingsBusy ? 'בונה Embeddings...' : 'בנה Embeddings מחדש'}
              </button>
            </div>
          </div>

          <div className="bot-layout">
            <aside className="bot-sidebar">
            <div className="bot-sidebar-head">
              <div>
                <p className="eyebrow">שיחות</p>
                <h4>היסטוריה</h4>
              </div>
              <input
                type="search"
                className="ghost-input"
                placeholder="חיפוש בשיחות..."
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="bot-sidebar-list">
              {filteredChatSessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`bot-session ${activeSessionId === s.id ? 'active' : ''}`}
                  onClick={() => selectSession(s.id)}
                >
                  <div className="bot-session-title">{s.title || 'שיחה'}</div>
                  <p className="muted small" style={{ textAlign: 'right' }}>
                    {(s.lastMessage || '').slice(0, 80) || '—'}
                  </p>
                  <div className="actions" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                    <span className="muted small">{new Date(s.updatedAt || Date.now()).toLocaleString()}</span>
                    <button
                      type="button"
                      className="ghost small danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeChatSession(s.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </button>
              ))}
              {!filteredChatSessions.length && <p className="muted small">לא נמצאו שיחות.</p>}
            </div>
          </aside>

            <div className="bot-thread">
              <div className="bot-messages">
                {chatMessages.map((m, idx) => (
                  <div key={m.id || idx} className={`bot-msg ${m.role === 'assistant' ? 'bot' : 'user'}`}>
                    <p>{m.content}</p>
                  </div>
                ))}
                {!chatMessages.length && <p className="muted">שאל שאלה על בסיס המידע שנשמר.</p>}
              </div>
              <form className="bot-input" onSubmit={sendChat}>
                <input
                  type="text"
                  placeholder="מה תרצה לדעת?"
                  value={botInput}
                  onChange={(e) => setBotInput(e.target.value)}
                  disabled={chatLoading}
                />
                <button type="submit" disabled={chatLoading}>
                  {chatLoading ? '⌛ שולח...' : 'שלח'}
                </button>
              </form>
              {(chatLoading || chatSteps.length) && (
                <div className="bot-progress" style={{ marginTop: 8, padding: '8px 12px', background: '#f7f9fb', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong className="small">סטטוס מענה</strong>
                    <span className="muted small">{Math.min(Math.round(chatProgress), 100)}%</span>
                  </div>
                  <div style={{ height: 6, background: '#e4ebf2', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${Math.min(chatProgress, 100)}%`, height: '100%', background: '#1d9bf0', transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {chatSteps.map((step) => (
                      <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          aria-hidden
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background:
                              step.status === 'done' ? '#2ecc71' : step.status === 'doing' ? '#f1c40f' : step.status === 'error' ? '#e74c3c' : '#cfd8e3',
                          }}
                        />
                        <span className="small" style={{ color: step.status === 'error' ? '#e74c3c' : 'inherit' }}>
                          {step.label}
                          {step.status === 'doing' ? '…' : ''}
                          {step.status === 'error' ? ' (שגיאה)' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {viewTable && (
        <div className="modal-backdrop">
          <div className="modal modal-wide">
            <div className="card-head">
              <div>
                <h2>{viewTable.name || 'טבלה'}</h2>
                <p className="muted small">
                  {new Date(viewTable.updatedAt || viewTable.createdAt || Date.now()).toLocaleString()}
                </p>
                <p className="muted small">
                  {(viewTable.columns || []).length} עמודות · {(viewTable.rows || []).length} שורות
                </p>
              </div>
              <button type="button" className="ghost" onClick={() => setViewTable(null)}>
                סגור
              </button>
            </div>
            <div className="stack" style={{ gap: '12px' }}>
              <p className="muted small">תצוגת DataGrid מאפשרת חיפוש וסינון גם על תוכן התאים.</p>
              {viewTableGrid.columns.length ? (
                <DataGrid
                  dataSource={viewTableGrid.data}
                  keyExpr="__row"
                  rtlEnabled
                  rowAlternationEnabled
                  columnAutoWidth
                  showBorders={false}
                  noDataText="אין נתונים בטבלה."
                >
                  <SearchPanel visible placeholder="חיפוש בנתוני הטבלה..." />
                  <HeaderFilter visible />
                  <FilterRow visible />
                  <Paging defaultPageSize={10} />
                  <Column
                    dataField="__row"
                    caption="#"
                    width={60}
                    allowEditing={false}
                    allowFiltering={false}
                    allowSorting
                    allowSearch={false}
                  />
                  {viewTableGrid.columns.map((col) => (
                    <Column
                      key={col.dataField}
                      dataField={col.dataField}
                      caption={col.caption}
                      allowSorting={false}
                      cellRender={({ value }) => (value ? value : <span className="muted small">—</span>)}
                    />
                  ))}
                </DataGrid>
              ) : (
                <p className="muted">אין נתונים בטבלה.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {viewNote && (
        <div className="modal-backdrop">
          <div className="modal modal-wide">
            <div className="card-head">
              <div>
                <h2>{viewNote.title || 'ללא כותרת'}</h2>
                <p className="muted small">
                  {new Date(viewNote.updatedAt || viewNote.createdAt || Date.now()).toLocaleString()}
                </p>
              </div>
              <button type="button" className="ghost" onClick={() => setViewNote(null)}>
                סגור
              </button>
            </div>
            <div className="guide-content" dangerouslySetInnerHTML={{ __html: viewNote.content }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default InfoPage;
