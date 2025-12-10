import { useEffect, useMemo, useState } from 'react';
import {
  fetchTools,
  fetchTool,
  createTool,
  updateTool,
  deleteTool,
} from '../../api.js';

const emptyForm = () => ({
  id: '',
  name: '',
  summary: '',
  kind: 'link',
  link: '',
  html: '',
});

function ToolsPage() {
  const [tools, setTools] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // {title, url}
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const loadTools = async (term = '') => {
    setLoading(true);
    const data = await fetchTools(term ? { search: term } : {});
    setTools(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTools();
  }, []);

  const filteredTools = useMemo(() => {
    if (!search) return tools;
    const term = search.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        (t.summary || '').toLowerCase().includes(term)
    );
  }, [tools, search]);

  const buildPreviewUrl = (tool) => {
    const raw = tool.url || tool.target || '';
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return `${window.location.origin}${withSlash}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    const payload =
      form.kind === 'link'
        ? { name: form.name, summary: form.summary, kind: 'link', link: form.link }
        : { name: form.name, summary: form.summary, kind: 'html', html: form.html };
    if (editingId) {
      await updateTool(editingId, payload);
    } else {
      await createTool(payload);
    }
    setForm(emptyForm());
    setEditingId('');
    await loadTools(search);
    setSaving(false);
  };

  const handleEdit = async (id) => {
    const full = await fetchTool(id);
    setEditingId(id);
    setFormOpen(true);
    setForm({
      id,
      name: full.name,
      summary: full.summary || '',
      kind: full.kind,
      link: full.kind === 'link' ? full.url : '',
      html: full.kind === 'html' ? full.htmlContent || '' : '',
    });
  };

  const handleDelete = async (id) => {
    await deleteTool(id);
    if (editingId === id) {
      setEditingId('');
      setForm(emptyForm());
    }
    loadTools(search);
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">כלי עזר</p>
            <h3>{editingId ? 'עריכת כלי' : 'הוספת כלי חדש'}</h3>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() => setFormOpen((o) => !o)}
          >
            {formOpen ? 'הסתר' : 'הוסף כלי חדש'} {formOpen ? '▲' : '➕'}
          </button>
        </div>

        {formOpen && (
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              שם הכלי
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                placeholder="לדוגמה: Regex Tester"
              />
            </label>
            <label>
              סוג
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm((p) => ({ ...p, kind: e.target.value, link: '', html: '' }))
                }
              >
                <option value="link">קישור חיצוני</option>
                <option value="html">קובץ HTML מקומי</option>
              </select>
            </label>
            <label className="full">
              תקציר
              <textarea
                rows="3"
                value={form.summary}
                onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                placeholder="מה הכלי עושה?"
              />
            </label>

            {form.kind === 'link' ? (
              <label className="full">
                כתובת URL
                <input
                  type="url"
                  value={form.link}
                  onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
                  placeholder="https://example.com/tool"
                  required
                />
              </label>
            ) : (
              <label className="full">
                תוכן HTML
                <textarea
                  rows="8"
                  value={form.html}
                  onChange={(e) => setForm((p) => ({ ...p, html: e.target.value }))}
                  placeholder="<!DOCTYPE html>..."
                  required
                />
              </label>
            )}

            <div className="actions">
              <button type="submit" disabled={saving}>
                {saving ? 'שומר...' : editingId ? 'עדכן כלי' : 'הוסף כלי'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditingId('');
                    setForm(emptyForm());
                  }}
                >
                  ביטול
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>כלים זמינים</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="search"
              placeholder="חיפוש בכלים..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                loadTools(e.target.value);
              }}
              style={{ maxWidth: 240 }}
            />
            {loading && <span className="muted small">טוען...</span>}
          </div>
        </div>
        <div className="notes-grid">
          {filteredTools.map((tool) => (
            <div key={tool.id} className="note-card">
              <div className="note-actions-top">
                <button type="button" className="ghost small" onClick={() => handleEdit(tool.id)}>
                  עריכה
                </button>
                {tool.kind === 'link' && (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => window.open(tool.url, '_blank')}
                  >
                    פתיחה
                  </button>
                )}
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => setPreview({ title: tool.name, url: buildPreviewUrl(tool) })}
                >
                  תצוגה
                </button>
                <button
                  type="button"
                  className="ghost danger small"
                  onClick={() => handleDelete(tool.id)}
                  title="מחק"
                >
                  מחיקה
                </button>
              </div>
              <h4>{tool.name}</h4>
              <p className="muted small">{tool.summary || 'ללא תקציר'}</p>
              <p className="tag" style={{ width: 'fit-content' }}>
                {tool.kind === 'link' ? 'קישור' : 'HTML מקומי'}
              </p>
            </div>
          ))}
          {!filteredTools.length && <p className="muted small">אין תוצאות.</p>}
        </div>
      </section>

      {preview && (
        <div
          className="modal-backdrop"
          style={{ background: 'rgba(15,23,42,0.65)' }}
          onClick={() => setPreview(null)}
        >
          <div
            className="modal"
            style={{
              width: '96vw',
              height: '96vh',
              maxWidth: 'none',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <button type="button" className="ghost" onClick={() => setPreview(null)}>
                סגור
              </button>
              <span className="muted small">{preview.title}</span>
            </div>
            <iframe
              title={preview.title}
              src={preview.url}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolsPage;
