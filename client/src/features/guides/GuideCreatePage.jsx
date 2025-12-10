import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchCategories, createGuide, fetchGuides, updateGuide, deleteGuide, importGuideFromWord } from '../../api.js';
import RichTextEditor from '../../components/RichTextEditor.jsx';

const createEmptyGuide = () => ({
  title: '',
  categoryId: '',
  content: '',
});

function GuideCreatePage() {
  const [categories, setCategories] = useState([]);
  const [guides, setGuides] = useState([]);
  const [form, setForm] = useState(createEmptyGuide());
  const [editingGuide, setEditingGuide] = useState(null);
  const [viewGuide, setViewGuide] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importForm, setImportForm] = useState({ file: null, title: '', categoryId: '' });
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cats, gds] = await Promise.all([fetchCategories(), fetchGuides()]);
    setCategories(cats);
    setGuides(gds);
    const editId = searchParams.get('id');
    if (editId) {
      const g = gds.find((x) => x.id === editId);
      if (g) {
        setEditingGuide(g);
        setForm({ title: g.title, categoryId: g.categoryId, content: g.content });
      }
    }
  };

  const openImportModal = () => {
    setImportModalOpen(true);
    setImportError('');
    setImportForm({ file: null, title: '', categoryId: '' });
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportError('');
    setImportForm({ file: null, title: '', categoryId: '' });
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0] || null;
    setImportForm((prev) => ({
      ...prev,
      file,
      title: prev.title || (file ? file.name.replace(/\.docx$/i, '') : ''),
    }));
    setImportError('');
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (importing) return;
    if (!importForm.file) {
      setImportError('בחרו קובץ Word בפורמט .docx');
      return;
    }
    setImporting(true);
    setImportError('');
    const formData = new FormData();
    formData.append('file', importForm.file);
    if (importForm.title.trim()) formData.append('title', importForm.title.trim());
    if (importForm.categoryId) formData.append('categoryId', importForm.categoryId);
    try {
      await importGuideFromWord(formData);
      closeImportModal();
      await loadData();
    } catch (err) {
      setImportError(err?.response?.data?.error || 'הייבוא נכשל, נסו שוב');
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (editingGuide) {
      await updateGuide(editingGuide.id, payload);
    } else {
      await createGuide(payload);
    }
    setForm(createEmptyGuide());
    setEditingGuide(null);
    loadData();
  };

  const startEdit = (guide) => {
    setEditingGuide(guide);
    setForm({ title: guide.title, categoryId: guide.categoryId, content: guide.content });
  };

  const openGuide = (guide) => {
    setViewGuide(guide);
  };

  const closeGuide = () => setViewGuide(null);

  const removeGuide = async () => {
    if (!editingGuide) return;
    await deleteGuide(editingGuide.id);
    setForm(createEmptyGuide());
    setEditingGuide(null);
    loadData();
  };

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">מדריך חדש</p>
          <h2>יצירת מדריך</h2>
          <p className="subtitle">כותרת, קטגוריה ותוכן עשיר ב-CKEditor CDN.</p>
        </div>
      </section>

      <section className="card">
        <form className="stack" onSubmit={handleSubmit}>
          <div className="card-head">
            <div>
              <p className="eyebrow">טופס מדריך</p>
              <h3>{editingGuide ? 'עריכת מדריך' : 'יצירת מדריך'}</h3>
            </div>
            <div className="actions">
              <button type="button" className="ghost" onClick={openImportModal}>
                צור ממסמך Word
              </button>
              {editingGuide && (
                <button type="button" className="danger ghost" onClick={removeGuide}>
                  מחק מדריך
                </button>
              )}
              <button type="submit">{editingGuide ? 'שמור מדריך' : 'צור מדריך'}</button>
            </div>
          </div>

          <div className="form-grid">
            <label>
              כותרת
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="איך להגדיר חיבור DB"
                required
              />
            </label>

            <label>
              קטגוריה
              <select value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
                <option value="">ללא</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="full">
            תוכן
            <div className="editor-wrapper full">
              <RichTextEditor value={form.content} onChange={(val) => setForm((p) => ({ ...p, content: val }))} />
            </div>
          </label>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">מדריכים אחרונים</p>
            <h3>בחר לעריכה</h3>
          </div>
        </div>
        <div className="template-list">
          {guides.map((g) => (
            <div key={g.id} className="template-row">
              <div>
                <strong>{g.title}</strong>
                <p className="muted small">
                  {categories.find((c) => c.id === g.categoryId)?.name || 'ללא קטגוריה'} •{' '}
                  {new Date(g.updatedAt || g.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
              <div className="actions inline-actions">
                <button type="button" className="ghost action-pill" onClick={() => openGuide(g)} title="צפייה">
                  👁️
                </button>
                <button type="button" className="ghost action-pill" onClick={() => startEdit(g)} title="עריכה">
                  ✏️
                </button>
              </div>
            </div>
          ))}
          {!guides.length && <p className="muted">אין מדריכים עדיין.</p>}
        </div>
      </section>

      {importModalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="card-head">
              <div>
                <p className="eyebrow">ייבוא וורד</p>
                <h3>צור מדריך מקובץ Word</h3>
              </div>
              <button type="button" className="ghost" onClick={closeImportModal}>
                סגור
              </button>
            </div>
            <form className="stack" onSubmit={handleImportSubmit}>
              <label className="full">
                קובץ Word
                <input type="file" accept=".docx" onChange={handleImportFile} />
                <p className="muted small">תומך בקובצי .docx בלבד.</p>
              </label>
              <div className="form-grid">
                <label>
                  כותרת (לא חובה)
                  <input
                    type="text"
                    value={importForm.title}
                    onChange={(e) => setImportForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="ללא כותרת - ייעשה שימוש בשם הקובץ"
                  />
                </label>
                <label>
                  קטגוריה (לא חובה)
                  <select
                    value={importForm.categoryId}
                    onChange={(e) => setImportForm((p) => ({ ...p, categoryId: e.target.value }))}
                  >
                    <option value="">ללא</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {importError && <p className="danger-text small">{importError}</p>}
              <div className="actions">
                <button type="button" className="ghost" onClick={closeImportModal}>
                  ביטול
                </button>
                <button type="submit" disabled={importing}>
                  {importing ? 'מייבא...' : 'צור ממסמך'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewGuide && (
        <div className="modal-backdrop">
          <div className="modal modal-wide">
            <div className="card-head">
              <div>
                <p className="eyebrow">{categories.find((c) => c.id === viewGuide.categoryId)?.name || 'ללא קטגוריה'}</p>
                <h2>{viewGuide.title}</h2>
                <p className="muted small">
                  {new Date(viewGuide.updatedAt || viewGuide.createdAt || Date.now()).toLocaleString()}
                </p>
              </div>
              <button type="button" className="ghost" onClick={closeGuide}>
                סגור
              </button>
            </div>
            <div className="guide-content" dangerouslySetInnerHTML={{ __html: viewGuide.content }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default GuideCreatePage;
