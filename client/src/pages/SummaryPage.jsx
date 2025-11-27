import { useEffect, useMemo, useState } from 'react';
import DataGrid, {
  Column,
  SearchPanel,
  GroupPanel,
  Grouping,
  Paging,
  FilterRow,
  HeaderFilter,
  ColumnChooser,
  MasterDetail,
} from 'devextreme-react/data-grid';
import { fetchTasks, fetchUsers, updateTask, deleteTask, cloneTask } from '../api.js';

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

function SummaryPage() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    userId: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const [editingTask, setEditingTask] = useState(null);
  const [editingForm, setEditingForm] = useState(null);

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

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [filters]);

  const loadUsers = async () => {
    const data = await fetchUsers();
    setUsers(data);
  };

  const loadTasks = async () => {
    const data = await fetchTasks(filters);
    setTasks(data.filter((t) => t.status !== 'done'));
  };

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setEditingForm({
      ...task,
      steps: (task.steps || []).map((s) => ({ ...s })),
    });
  };

  const updateStep = (id, key, value) => {
    setEditingForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === id ? { ...s, [key]: value } : s)),
    }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingForm) return;
    await updateTask(editingForm.id, editingForm);
    setEditingTask(null);
    setEditingForm(null);
    loadTasks();
  };

  const closeEdit = () => {
    setEditingTask(null);
    setEditingForm(null);
  };

  const toggleStepStatus = async (taskId, stepId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = {
      ...task,
      steps: task.steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s)),
    };
    await updateTask(taskId, updated);
    loadTasks();
  };

  const toggleTaskFlag = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    await updateTask(taskId, { ...task, flag: !task.flag });
    loadTasks();
  };

  const handleClone = async (id) => {
    await cloneTask(id);
    loadTasks();
  };

  const handleDelete = async (id) => {
    await deleteTask(id);
    loadTasks();
  };

  const handleStatusChange = (value) => {
    if (!editingForm) return;
    let steps = editingForm.steps || [];
    if (value === 'done') {
      steps = steps.map((s) => ({ ...s, completed: true }));
    } else if (value === 'open') {
      steps = steps.map((s) => ({ ...s, completed: false }));
    } else if (value === 'in-progress') {
      const hasCompleted = steps.some((s) => s.completed);
      if (!hasCompleted && steps.length) {
        steps = steps.map((s, idx) => ({ ...s, completed: idx === 0 }));
      }
    }
    setEditingForm((prev) => ({ ...prev, status: value, steps }));
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
    const open = tasks.filter((t) => t.status === 'open').length;
    const progress = tasks.reduce((sum, t) => sum + (t.progress || 0), 0);
    const avg = total ? Math.round((progress / total) * 100) : 0;
    return { total, done, avg, open, inProgress };
  }, [tasks]);

  const applyStatusQuick = (status) => setFilters((prev) => ({ ...prev, status }));
  const clearFilters = () =>
    setFilters({
      search: '',
      userId: '',
      status: '',
      startDate: '',
      endDate: '',
    });

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">סיכום משימות</p>
          <h2>שליטה מהירה במשימות</h2>
          <p className="subtitle">קפיצה בלחיצה: סנן לפי סטטוס, נקה חיתוכים, או חפש טקסט חופשי.</p>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => applyStatusQuick('open')}>
              פתוחות ({stats.open})
            </button>
            <button type="button" className="ghost" onClick={() => applyStatusQuick('in-progress')}>
              בתהליך ({stats.inProgress})
            </button>
            <button type="button" className="ghost" onClick={() => applyStatusQuick('done')}>
              הושלמו ({stats.done})
            </button>
            <button type="button" onClick={clearFilters}>
              ניקוי חיתוכים
            </button>
          </div>
        </div>
        <div className="stats">
          <div>
            <p className="muted small">סה״כ משימות</p>
            <h3>{stats.total}</h3>
          </div>
          <div>
            <p className="muted small">הושלמו</p>
            <h3>{stats.done}</h3>
          </div>
          <div>
            <p className="muted small">ממוצע התקדמות</p>
            <h3>{stats.avg}%</h3>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="filters">
          <input
            type="search"
            placeholder="חיפוש חופשי בכותרת/תוכן/משתמש"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
          <select value={filters.userId} onChange={(e) => setFilter('userId', e.target.value)}>
            <option value="">כל המשתמשים</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">כל הסטטוסים</option>
            <option value="open">פתוחה</option>
            <option value="in-progress">בתהליך</option>
            <option value="done">הושלמה</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilter('startDate', e.target.value)}
            placeholder="מתאריך"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilter('endDate', e.target.value)}
            placeholder="עד תאריך"
          />
        </div>

        <DataGrid
          dataSource={tasks}
          keyExpr="id"
          rtlEnabled
          rowAlternationEnabled
          allowColumnReordering
          allowColumnResizing
          columnAutoWidth
          showBorders={false}
          sorting={{ mode: 'multiple' }}
          onRowPrepared={(e) => {
            if (e.data?.flag && e.rowElement) {
              e.rowElement.classList.add('flagged-row');
            }
          }}
        >
          <SearchPanel visible placeholder="חיפוש בגריד..." />
          <FilterRow visible />
          <HeaderFilter visible />
          <GroupPanel visible emptyPanelText="גררו כותרת לכאן לקיבוץ" />
          <Grouping contextMenuEnabled />
          <ColumnChooser enabled />
          <Paging defaultPageSize={10} />

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
          <Column
            dataField="title"
            caption="כותרת"
            cellRender={({ data }) => (
              <span className={data.flag ? 'flagged-title' : ''}>{data.title}</span>
            )}
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
            allowSorting
            allowGrouping
            showWhenGrouped
          />
          <Column
            dataField="status"
            caption="סטטוס"
            cellRender={({ data }) => <StatusPill status={data.status} />}
            width={140}
          />
          <Column
            dataField="progress"
            caption="התקדמות"
            cellRender={({ data }) => <ProgressCell value={data.progress} />}
            width={160}
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
            dataField="content"
            caption="תוכן"
            width={280}
            cellRender={({ data }) => <span className="muted small">{data.content}</span>}
          />
          <Column
            caption="שלבים"
            width={260}
            cellRender={({ data }) => (
              <StepListCell steps={data.steps || []} onToggle={(stepId) => toggleStepStatus(data.id, stepId)} />
            )}
          />
          <Column
            caption="פעולות"
            width={140}
            cellRender={({ data }) => (
              <div className="actions inline-actions">
                <button
                  type="button"
                  className="ghost action-pill"
                  onClick={() => openEdit(data)}
                  title="עריכה"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="ghost action-pill"
                  onClick={() => handleClone(data.id)}
                  title="שכפול"
                >
                  📄
                </button>
                <button
                  type="button"
                  className="danger ghost action-pill"
                  onClick={() => handleDelete(data.id)}
                  title="מחיקה"
                >
                  🗑️
                </button>
              </div>
            )}
          />
          <MasterDetail enabled render={({ data }) => <StepDetail steps={data.steps || []} />} />
        </DataGrid>
      </section>

      {editingTask && editingForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="card-head">
              <div>
                <p className="eyebrow">עריכת משימה</p>
                <h3>{editingForm.title}</h3>
              </div>
              <div className="actions">
                <button type="button" className="ghost" onClick={closeEdit}>
                  סגור
                </button>
                <button type="button" onClick={saveEdit}>
                  שמור
                </button>
              </div>
            </div>

            <div className="form-grid">
              <label>
                כותרת
                <input
                  type="text"
                  value={editingForm.title}
                  onChange={(e) => setEditingForm((p) => ({ ...p, title: e.target.value }))}
                />
              </label>
              <label>
                משתמש
                <select
                  value={editingForm.userId}
                  onChange={(e) => setEditingForm((p) => ({ ...p, userId: e.target.value }))}
                >
                  <option value="">ללא</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                התחלה
                <input
                  type="date"
                  value={editingForm.startDate || ''}
                  onChange={(e) => setEditingForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </label>
              <label>
                סיום
                <input
                  type="date"
                  value={editingForm.endDate || ''}
                  onChange={(e) => setEditingForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </label>
              <label className="full">
                תוכן
                <textarea
                  rows="3"
                  value={editingForm.content || ''}
                  onChange={(e) => setEditingForm((p) => ({ ...p, content: e.target.value }))}
                />
              </label>
            <label>
              סטטוס
              <select value={editingForm.status || ''} onChange={(e) => handleStatusChange(e.target.value)}>
                <option value="open">פתוחה</option>
                <option value="in-progress">בתהליך</option>
                <option value="done">הושלמה</option>
              </select>
            </label>
            <label>
              משימה דחופה
              <div className="inline-check">
                <input
                  type="checkbox"
                  checked={!!editingForm.flag}
                  onChange={(e) => setEditingForm((p) => ({ ...p, flag: e.target.checked }))}
                />
                <span>סימון בולט</span>
              </div>
            </label>
          </div>

            <div className="steps">
              <div className="card-head">
                <p className="eyebrow">שלבים</p>
              </div>
              {editingForm.steps?.map((step) => (
                <div key={step.id} className="step-row">
                  <input
                    type="checkbox"
                    checked={!!step.completed}
                    onChange={() => updateStep(step.id, 'completed', !step.completed)}
                  />
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateStep(step.id, 'title', e.target.value)}
                    placeholder="תיאור שלב"
                  />
                  <input
                    type="text"
                    value={step.link || ''}
                    onChange={(e) => updateStep(step.id, 'link', e.target.value)}
                    placeholder="קישור / פרטים"
                  />
                </div>
              ))}
              {!editingForm.steps?.length && <p className="muted">אין שלבים.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const StepDetail = ({ steps }) => (
  <div className="template-list compact">
    {steps.map((s) => (
      <div key={s.id} className="template-row">
        <div>
          <strong>{s.title}</strong>
          {s.link && (
            <p className="muted small">
              <a href={s.link} target="_blank" rel="noreferrer">
                קישור
              </a>
            </p>
          )}
        </div>
        <span className={`pill pill-${s.completed ? 'done' : 'open'}`}>{s.completed ? 'בוצע' : 'פתוח'}</span>
      </div>
    ))}
    {!steps.length && <p className="muted small">אין שלבים להצגה.</p>}
  </div>
);

export default SummaryPage;

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
