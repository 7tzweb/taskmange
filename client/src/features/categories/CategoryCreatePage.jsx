import { useEffect, useState } from 'react';
import { fetchCategories, createCategory, deleteCategory } from '../../api.js';

function CategoryCreatePage() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const data = await fetchCategories();
    setCategories(data);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!name) return;
    await createCategory({ name });
    setName('');
    load();
  };

  const remove = async (id) => {
    await deleteCategory(id);
    load();
  };

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">קטגוריות</p>
          <h2>יצירת קטגוריה למדריכים</h2>
          <p className="subtitle">שם קצר וברור, לשיוך מדריכים.</p>
        </div>
      </section>

      <section className="card">
        <form className="stack" onSubmit={save}>
          <div className="card-head">
            <div>
              <p className="eyebrow">טופס קטגוריה</p>
              <h3>יצירה מהירה</h3>
            </div>
            <button type="submit">שמור</button>
          </div>

          <label>
            שם קטגוריה
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="DevOps / Backend / Frontend"
              required
            />
          </label>
        </form>
      </section>

      <section className="card">
        <div className="template-list">
          {categories.map((c) => (
            <div key={c.id} className="template-row">
              <div>
                <strong>{c.name}</strong>
                <p className="muted small">
                  נוצר: {new Date(c.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
              <button type="button" className="ghost danger" onClick={() => remove(c.id)}>
                מחיקה
              </button>
            </div>
          ))}
          {!categories.length && <p className="muted">אין קטגוריות עדיין.</p>}
        </div>
      </section>
    </div>
  );
}

export default CategoryCreatePage;
