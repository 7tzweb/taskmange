import { useEffect, useMemo, useState } from 'react';
import DataGrid, {
  Column,
  Paging,
  SearchPanel,
  Grouping,
  GroupPanel,
  FilterRow,
  HeaderFilter,
  ColumnChooser,
} from 'devextreme-react/data-grid';
import { fetchUsers, fetchTemplates, fetchTasks, createTask, updateTask, deleteTask, cloneTask } from '../api.js';

const uid = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);

const createEmptyTask = () => ({
  title: '',
  startDate: '',
  endDate: '',
  content: '',
  userId: '',
  templateId: '',
  flag: false,
  steps: [],
});

const StatusPill = ({ status }) => (
  <span className={`pill pill-${status}`}>
    {status === 'done' && 'הושלמה'}
    {status === 'in-progress' && 'בתהליך'}
    {status === 'open' && 'פתוחה'}
  </span>
);

const ProgressCell = ({ value }) => {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="progress">
      <span style={{ width: `${pct}%` }} />
      <small>{pct}%</small>
    </div>
  );
};

const ActionsCell = ({ data, onEdit, onClone, onDelete }) => (
  <div className="actions inline-actions">
    <button type="button" className="ghost action-pill" onClick={() => onEdit(data)} title="עריכה">
      ✏️
    </button>
    <button type="button" className="ghost action-pill" onClick={() => onClone(data.id)} title="שכפול">
      📄
    </button>
    <button type="button" className="danger ghost action-pill" onClick={() => onDelete(data.id)} title="מחיקה">
      🗑️
    </button>
  </div>
);

function CreateTaskPage() {
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState(createEmptyTask);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const userMap = useMemo(
    () =>
      users.reduce((acc, user) => {
        acc[user.id] = user.name;
        return acc;
      }, {}),
    [users]
  );

  const userTaskCount = useMemo(
    () =>
      tasks.reduce((acc, t) => {
        const key = t.userId || '—';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    [tasks]
  );

  const loadAll = async () => {
    setLoading(true);
    const [u, t, tsks] = await Promise.all([fetchUsers(), fetchTemplates(), fetchTasks()]);
    setUsers(u);
    setTemplates(t);
    setTasks(tsks);
    setLoading(false);
  };

  const handleTaskChange = (key, value) => {
    setTaskForm((prev) => ({ ...prev, [key]: value }));
  };

const handleStepChange = (id, value) => {
  setTaskForm((prev) => ({
    ...prev,
    steps: prev.steps.map((s) => (s.id === id ? { ...s, title: value } : s)),
  }));
};

const handleStepLinkChange = (id, value) => {
  setTaskForm((prev) => ({
    ...prev,
    steps: prev.steps.map((s) => (s.id === id ? { ...s, link: value } : s)),
  }));
};

const toggleStep = (id) => {
  setTaskForm((prev) => ({
    ...prev,
    steps: prev.steps.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)),
  }));
  };

const addStep = () => {
  setTaskForm((prev) => ({
    ...prev,
    steps: [...prev.steps, { id: uid(), title: '', link: '', completed: false }],
  }));
};

  const removeStep = (id) => {
    setTaskForm((prev) => ({ ...prev, steps: prev.steps.filter((s) => s.id !== id) }));
  };

  const toggleGridStep = async (taskId, stepId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = {
      ...task,
      steps: task.steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s)),
    };
    await updateTask(taskId, updated);
    loadTasks(search);
  };

  const toggleTaskFlag = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    await updateTask(taskId, { ...task, flag: !task.flag });
    loadTasks(search);
  };

  const handleTemplateSelect = (templateId) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) {
      setTaskForm((prev) => ({ ...prev, templateId: '', steps: [] }));
      return;
    }
    setTaskForm((prev) => ({
      ...prev,
      templateId,
      startDate: prev.startDate || tpl.defaultStartDate,
      endDate: prev.endDate || tpl.defaultEndDate,
      steps: tpl.steps.map((s) => ({ ...s, link: s.link || '', completed: false })),
    }));
  };

  const saveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title) return;
    const payload = { ...taskForm };
    if (editingTask) {
      await updateTask(editingTask.id, payload);
    } else {
      await createTask(payload);
    }
    setTaskForm(createEmptyTask());
    setEditingTask(null);
    loadTasks(search);
  };

  const loadTasks = async (searchTerm = '') => {
    setLoading(true);
    const data = await fetchTasks({ search: searchTerm });
    setTasks(data);
    setLoading(false);
  };

  const handleDeleteTask = async (id) => {
    await deleteTask(id);
    loadTasks(search);
  };

  const handleCloneTask = async (id) => {
    await cloneTask(id);
    loadTasks(search);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      startDate: task.startDate,
      endDate: task.endDate,
      content: task.content,
      userId: task.userId,
      templateId: task.templateId,
      steps: task.steps || [],
    });
  };

  const clearTask = () => {
    setTaskForm(createEmptyTask());
    setEditingTask(null);
  };

  const filteredTasks = useMemo(() => {
    if (!search) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.content || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [tasks, search]);

  return (
    <div className="stack">
      <section className="card hero" id="task-form">
        <div>
          <p className="eyebrow">יצירת משימה חדשה</p>
          <h2>כמה קל זה יכול להיות?</h2>
          <p className="subtitle">בחרו טמפלייט, הוסיפו שלבים, ושייכו למשתמש בלחיצה.</p>
          <div className="tags">
            <span className="tag">RTL</span>
            <span className="tag">DevExpress Grid</span>
            <span className="tag">LowDB API</span>
          </div>
        </div>
      </section>

      <section className="grid two">
        <form className="card" onSubmit={saveTask}>
          <div className="card-head">
            <div>
              <p className="eyebrow">טופס משימה</p>
              <h3>{editingTask ? 'עריכת משימה' : 'יצירת משימה'}</h3>
            </div>
            <div className="actions">
              <button type="submit">{editingTask ? 'שמור שינויים' : 'שמור משימה'}</button>
              {editingTask && (
                <button type="button" className="ghost" onClick={clearTask}>
                  ביטול
                </button>
              )}
            </div>
          </div>

          <div className="form-grid">
            <label>
              כותרת
              <input
                type="text"
                value={taskForm.title}
                onChange={(e) => handleTaskChange('title', e.target.value)}
                placeholder="לדוגמה: חיבור לדאטה בייס"
                required
              />
            </label>
            <label>
              משימה דחופה
              <div className="inline-check">
                <input
                  type="checkbox"
                  checked={!!taskForm.flag}
                  onChange={(e) => handleTaskChange('flag', e.target.checked)}
                />
                <span>סימון בולט</span>
              </div>
            </label>

            <label>
              שיוך משתמש
              <select value={taskForm.userId} onChange={(e) => handleTaskChange('userId', e.target.value)}>
                <option value="">בחר משתמש</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              תאריך התחלה
              <input
                type="date"
                value={taskForm.startDate}
                onChange={(e) => handleTaskChange('startDate', e.target.value)}
              />
            </label>

            <label>
              תאריך סיום
              <input
                type="date"
                value={taskForm.endDate}
                onChange={(e) => handleTaskChange('endDate', e.target.value)}
              />
            </label>

            <label className="full">
              תוכן / פירוט
              <textarea
                rows="3"
                value={taskForm.content}
                onChange={(e) => handleTaskChange('content', e.target.value)}
                placeholder="תיאור קצר של המשימה"
              />
            </label>

            <label>
              טמפלייט
              <select value={taskForm.templateId} onChange={(e) => handleTemplateSelect(e.target.value)}>
                <option value="">ללא</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="steps">
            <div className="card-head">
              <div>
                <p className="eyebrow">שלבי המשימה</p>
                <h4>צ׳קבוקסים דינמיים</h4>
              </div>
              <button type="button" className="ghost" onClick={addStep}>
                הוסף שלב
              </button>
            </div>

            {taskForm.steps.length === 0 && <p className="muted">אין שלבים עדיין.</p>}
            {taskForm.steps.map((step) => (
              <div key={step.id} className="step-row">
                <input
                  type="checkbox"
                  checked={!!step.completed}
                  onChange={() => toggleStep(step.id)}
                  aria-label="סמן שלב"
                />
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => handleStepChange(step.id, e.target.value)}
                  placeholder="תיאור שלב"
                />
                <input
                  type="text"
                  value={step.link || ''}
                  onChange={(e) => handleStepLinkChange(step.id, e.target.value)}
                  placeholder="קישור / פרטים"
                />
                <button type="button" className="ghost danger" onClick={() => removeStep(step.id)}>
                  הסר
                </button>
              </div>
            ))}
          </div>
        </form>

      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">משימות חיות</p>
            <h3>גריד DevExpress עם חיפוש, סידור ופעולות</h3>
          </div>
          <input
            type="search"
            placeholder="חיפוש חופשי..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              loadTasks(e.target.value);
            }}
          />
        </div>

        <DataGrid
          dataSource={filteredTasks}
          keyExpr="id"
          rtlEnabled
          rowAlternationEnabled
          allowColumnReordering
          allowColumnResizing
          columnAutoWidth
          showBorders={false}
          loadPanel={{ enabled: loading }}
          sorting={{ mode: 'multiple' }}
          onRowPrepared={(e) => {
            if (e.data?.flag && e.rowElement) {
              e.rowElement.classList.add('flagged-row');
            }
          }}
        >
          <SearchPanel visible highlightCaseSensitive={false} placeholder="חיפוש בגריד..." />
          <FilterRow visible />
          <HeaderFilter visible />
          <GroupPanel visible emptyPanelText="גררו כותרת לכאן לקיבוץ" />
          <Grouping contextMenuEnabled />
          <ColumnChooser enabled />
          <Paging defaultPageSize={8} />
          <Column
            dataField="flag"
            caption="סימון"
            width={70}
            allowSorting={false}
            cellRender={({ data }) => (
              <button type="button" className="ghost icon-flag" onClick={() => toggleTaskFlag(data.id)}>
                {data.flag ? '⚑' : '⚐'}
              </button>
            )}
          />
          <Column dataField="title" caption="כותרת" />
          <Column
            dataField="flag"
            caption="סימון"
            width={80}
            cellRender={({ data }) => (data.flag ? <span className="pill pill-flag">⚑</span> : null)}
          />
          <Column
            dataField="userId"
            caption="משתמש"
            lookup={{ dataSource: users, valueExpr: 'id', displayExpr: 'name' }}
            cellRender={({ data }) => {
              const name = userMap[data.userId] || '—';
              const count = userTaskCount[data.userId || '—'] || 0;
              return <span>{count ? `${name} (${count})` : name}</span>;
            }}
          />
          <Column
            dataField="status"
            caption="סטטוס"
            cellRender={({ data }) => <StatusPill status={data.status} />}
            width={120}
          />
          <Column
            dataField="progress"
            caption="התקדמות"
            cellRender={({ data }) => <ProgressCell value={data.progress} />}
            width={140}
          />
          <Column
            caption="שלבים"
            width={260}
            cellRender={({ data }) => (
              <StepListCell steps={data.steps || []} onToggle={(stepId) => toggleGridStep(data.id, stepId)} />
            )}
          />
          <Column
            dataField="startDate"
            caption="התחלה"
            dataType="date"
            calculateCellValue={(row) => (row.startDate ? new Date(row.startDate) : null)}
          />
          <Column
            dataField="endDate"
            caption="סיום"
            dataType="date"
            calculateCellValue={(row) => (row.endDate ? new Date(row.endDate) : null)}
          />
          <Column
            caption="פעולות"
            cellRender={({ data }) => (
              <ActionsCell data={data} onEdit={handleEditTask} onClone={handleCloneTask} onDelete={handleDeleteTask} />
            )}
            width={180}
            alignment="center"
          />
        </DataGrid>
      </section>
    </div>
  );
}

export default CreateTaskPage;

const StepListCell = ({ steps, onToggle }) => (
  <div className="step-inline">
    {steps.map((s) => (
      <label key={s.id} className="step-inline-row">
        <input type="checkbox" checked={!!s.completed} onChange={() => onToggle(s.id)} />
        <span className={s.completed ? 'muted small' : ''}>{s.title}</span>
      </label>
    ))}
    {!steps.length && <span className="muted small">אין שלבים</span>}
  </div>
);
