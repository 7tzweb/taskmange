import { useEffect, useMemo, useState } from 'react';
import {
  createFavorite,
  deleteFavorite,
  fetchFavorites,
  updateFavorite,
  importFavorites,
} from '../../api.js';

function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ id: '', title: '', link: '', content: '' });
  const [importing, setImporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const data = await fetchFavorites();
    setFavorites(data);
  };

  const filtered = useMemo(() => {
    if (!search) return favorites;
    return favorites.filter(
      (f) =>
        (f.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.content || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [favorites, search]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.title) return;
    if (form.id) {
      await updateFavorite(form.id, form);
    } else {
      await createFavorite(form);
    }
    setForm({ id: '', title: '', link: '', content: '' });
    load();
  };

  const editFav = (fav) => {
    setForm(fav);
    setFormOpen(true);
  };
  const removeFav = async (id) => {
    await deleteFavorite(id);
    if (form.id === id) setForm({ id: '', title: '', link: '', content: '' });
    load();
  };

  const handleImport = async (file) => {
    if (!file) return;
    const text = await file.text();
    setImporting(true);
    try {
      await importFavorites(text);
      await load();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">מועדפים</p>
          <h2>ניהול מועדפים</h2>
          <p className="subtitle">חיפוש חופשי בכותרת ובתוכן, שמירה וקפיצה בלחיצה.</p>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">{form.id ? 'עריכת מועדף' : 'מועדף חדש'}</p>
            <h3>{form.id ? 'עדכון מועדף' : 'הוספת מועדף'}</h3>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() => setFormOpen((o) => !o)}
          >
            {formOpen ? 'הסתר' : 'הוסף מועדף'} {formOpen ? '▲' : '➕'}
          </button>
        </div>
        {formOpen && (
          <form className="stack" onSubmit={save}>
            <div className="form-grid">
              <label>
                כותרת
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="שם המועדף"
                />
              </label>
              <label>
                קישור
                <input
                  type="url"
                  value={form.link}
                  onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
                  placeholder="https://example.com"
                />
              </label>
              <label className="full">
                תוכן / תיאור (HTML או טקסט)
                <textarea
                  rows={4}
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  placeholder="אפשר להדביק כאן HTML או תיאור חופשי"
                />
              </label>
            </div>
            <div className="actions">
              {form.id && (
                <button type="button" className="danger ghost" onClick={() => removeFav(form.id)}>
                  מחק
                </button>
              )}
              <button type="submit">{form.id ? 'שמור' : 'הוסף'}</button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">רשימת מועדפים</p>
            <h3>תצוגת גריד</h3>
          </div>
          <input
            type="search"
            placeholder="חיפוש בכותרת / תוכן"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: '220px' }}
          />
          <label className="import-btn">
            <input
              type="file"
              accept=".html,text/html"
              style={{ display: 'none' }}
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
            {importing ? 'מייבא...' : 'ייבוא HTML מועדפים'}
          </label>
        </div>
        <div className="notes-grid">
          {filtered.map((fav) => {
            const searchTerm = search.trim().toLowerCase();
            const showContent =
              !!searchTerm && (fav.content || '').toLowerCase().includes(searchTerm);

            return (
              <div key={fav.id} className="note-card">
                <div className="note-actions-top">
                  {fav.link && (
                    <button
                      type="button"
                      className="ghost action-pill icon-only"
                      title="כניסה"
                      aria-label="כניסה"
                      onClick={() => window.open(fav.link, '_blank')}
                    >
                      🔗
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghost action-pill icon-only"
                    title="עריכה"
                    aria-label="עריכה"
                    onClick={() => editFav(fav)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="ghost action-pill icon-only"
                    title="מחיקה"
                    aria-label="מחיקה"
                    onClick={() => removeFav(fav.id)}
                  >
                    ⌫
                  </button>
                </div>
                <div className="note-row">
                  <div className="note-title">
                    <h4>{fav.title}</h4>
                    {fav.link && (
                      <p className="muted small note-link">
                        {fav.link}
                      </p>
                    )}
                  </div>
                </div>
                {fav.link && (
                  <a
                    className="link-truncate"
                    href={fav.link}
                    target="_blank"
                    rel="noreferrer"
                    title={fav.link}
                  >
                    {fav.link}
                  </a>
                )}
                {showContent && (
                  <div
                    className="note-preview"
                    dangerouslySetInnerHTML={{
                      __html: fav.content || '<em>אין תוכן</em>',
                    }}
                  />
                )}
              </div>
            );
          })}
          {!filtered.length && <p className="muted">אין מועדפים עדיין.</p>}
        </div>
      </section>
    </div>
  );
}

export default FavoritesPage;
