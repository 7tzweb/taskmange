import { useEffect, useState } from 'react';
import { createTemplate, deleteTemplate, fetchTemplates, updateTemplate } from '../api.js';

const uid = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);

const createEmptyTemplate = () => ({
  id: '',
  name: '',
  defaultStartDate: '',
  defaultEndDate: '',
  steps: [{ id: uid(), title: '', link: '' }],
});

function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [templateForm, setTemplateForm] = useState(createEmptyTemplate);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const data = await fetchTemplates();
    setTemplates(data);
  };

  const saveTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.name) return;
    if (templateForm.id) {
      await updateTemplate(templateForm.id, templateForm);
    } else {
      await createTemplate(templateForm);
    }
    setTemplateForm(createEmptyTemplate());
    loadTemplates();
  };

  const addTemplateStep = () => {
    setTemplateForm((prev) => ({ ...prev, steps: [...prev.steps, { id: uid(), title: '', link: '' }] }));
  };

  const handleTemplateStepChange = (id, value) => {
    setTemplateForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === id ? { ...s, title: value } : s)),
    }));
  };

  const removeTemplateStep = (id) => {
    setTemplateForm((prev) => ({ ...prev, steps: prev.steps.filter((s) => s.id !== id) }));
  };

  const startEditTemplate = (tpl) => {
    setTemplateForm(tpl);
  };

  const removeTemplate = async (id) => {
    await deleteTemplate(id);
    loadTemplates();
  };

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">טמפלייטים</p>
          <h2>בניית תהליך קבוע</h2>
          <p className="subtitle">צרו שלבים שחוזרים על עצמם ויישמו אותם לכל משימה.</p>
        </div>
      </section>

      <section className="card">
        <form onSubmit={saveTemplate} className="stack">
          <div className="card-head">
            <div>
              <p className="eyebrow">טופס טמפלייט</p>
              <h3>{templateForm.id ? 'עריכת טמפלייט' : 'יצירת טמפלייט'}</h3>
            </div>
            <button type="submit">{templateForm.id ? 'שמור טמפלייט' : 'צור טמפלייט'}</button>
          </div>

          <label>
            שם הטמפלייט
            <input
              type="text"
              value={templateForm.name}
              onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Onboarding DB"
            />
          </label>

          <div className="form-grid">
            <label>
              תאריך התחלה ברירת מחדל
              <input
                type="date"
                value={templateForm.defaultStartDate}
                onChange={(e) => setTemplateForm((p) => ({ ...p, defaultStartDate: e.target.value }))}
              />
            </label>
            <label>
              תאריך סיום ברירת מחדל
              <input
                type="date"
                value={templateForm.defaultEndDate}
                onChange={(e) => setTemplateForm((p) => ({ ...p, defaultEndDate: e.target.value }))}
              />
            </label>
          </div>

          <div className="steps mini">
            <div className="card-head">
              <p className="eyebrow">שלבים בטמפלייט</p>
              <button type="button" className="ghost" onClick={addTemplateStep}>
                הוסף שלב
              </button>
            </div>
            {templateForm.steps.map((step) => (
              <div key={step.id} className="step-row">
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => handleTemplateStepChange(step.id, e.target.value)}
                  placeholder="לדוגמה: בניית DB"
                />
                <input
                  type="text"
                  value={step.link || ''}
                  onChange={(e) => setTemplateForm((p) => ({
                    ...p,
                    steps: p.steps.map((s) => (s.id === step.id ? { ...s, link: e.target.value } : s)),
                  }))}
                  placeholder="קישור / פרטים"
                />
                <button type="button" className="ghost danger" onClick={() => removeTemplateStep(step.id)}>
                  הסר
                </button>
              </div>
            ))}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="template-list">
          {templates.map((tpl) => (
            <div key={tpl.id} className="template-row">
              <div>
                <strong>{tpl.name}</strong>
                <p className="muted small">
                  {tpl.steps.length} שלבים • {tpl.defaultStartDate || '—'} → {tpl.defaultEndDate || '—'}
                </p>
              </div>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => startEditTemplate(tpl)}>
                  ערוך
                </button>
                <button type="button" className="ghost danger" onClick={() => removeTemplate(tpl.id)}>
                  מחק
                </button>
              </div>
            </div>
          ))}
          {templates.length === 0 && <p className="muted">אין טמפלייטים עדיין.</p>}
        </div>
      </section>
    </div>
  );
}

export default TemplatesPage;
