import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RichTextEditor from '../components/RichTextEditor.jsx';
import { askBot, createNote, deleteNote, fetchNotes, updateNote } from '../api.js';

const createEmptyNote = () => ({ id: '', title: '', content: '' });
const stripHtml = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function InfoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('general');
  const [notes, setNotes] = useState([]);
  const [noteForm, setNoteForm] = useState(createEmptyNote());
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [botMessages, setBotMessages] = useState([]);
  const [botInput, setBotInput] = useState('');
  const [viewNote, setViewNote] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'bot') setTab('bot');
  }, [searchParams]);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'bot') next.set('tab', 'bot');
      else next.delete('tab');
      return next;
    });
  }, [tab, setSearchParams]);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    const data = await fetchNotes();
    setNotes(data);
  };

  const filteredNotes = useMemo(() => {
    if (!search) return notes;
    return notes.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (n.content || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [notes, search]);

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

  const sendBot = async (e) => {
    e.preventDefault();
    if (!botInput.trim()) return;
    const question = botInput.trim();
    setBotMessages((msgs) => [...msgs, { from: 'user', text: question }]);
    setBotInput('');
    try {
      const res = await askBot({ question });
      const cleanAnswer = res.answer || 'לא מצאתי מידע רלוונטי בנתונים.';
      setBotMessages((msgs) => [...msgs, { from: 'bot', text: cleanAnswer }]);
    } catch (err) {
      setBotMessages((msgs) => [...msgs, { from: 'bot', text: 'לא הצלחתי לקבל תשובה כרגע, נסה שוב.' }]);
    }
  };

  const currentTabLabel = tab === 'general' ? 'מידע כללי' : 'הבוט';
  const switchTab = (nextTab) => {
    setTab(nextTab);
    setDropdownOpen(false);
  };

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">מידע</p>
          <h2>מרכז מידע</h2>
          <p className="subtitle">סטיקי-נוטס עם עורך עשיר, ובוט שמחפש במידע שנשמר.</p>
          <div className="tags">
            <span className="tag">Notes</span>
            <span className="tag">AI Bot</span>
          </div>
        </div>
        <div className="actions inline-actions">
          <div
            className={`mini-dropdown ${dropdownOpen ? 'open' : ''}`}
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <button type="button" onClick={() => setDropdownOpen((v) => !v)}>
              {currentTabLabel} ▾
            </button>
            {dropdownOpen && (
              <div className="dropdown-menu">
                <button type="button" onClick={() => switchTab('general')}>
                  מידע כללי
                </button>
                <button type="button" onClick={() => switchTab('bot')}>
                  הבוט
                </button>
              </div>
            )}
          </div>
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

      {tab === 'bot' && (
        <section className="card">
          <div className="bot-area">
            <div className="bot-messages">
              {botMessages.map((m, idx) => (
                <div key={idx} className={`bot-msg ${m.from}`}>
                  <p>{m.text}</p>
                </div>
              ))}
              {!botMessages.length && <p className="muted">שאל שאלה על בסיס המידע ששמרת.</p>}
            </div>
            <form className="bot-input" onSubmit={sendBot}>
              <input
                type="text"
                placeholder="מה תרצה לדעת?"
                value={botInput}
                onChange={(e) => setBotInput(e.target.value)}
              />
              <button type="submit">שלח</button>
            </form>
          </div>
        </section>
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
