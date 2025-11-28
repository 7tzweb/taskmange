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
  Export,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { fetchTasks, fetchUsers } from '../api.js';

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

function CompletedTasksPage() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');

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
  }, [search, userId]);

  const loadUsers = async () => {
    const data = await fetchUsers();
    setUsers(data);
  };

  const loadTasks = async () => {
    const data = await fetchTasks({ status: 'done', search, userId });
    setTasks(data);
  };

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">משימות שהושלמו</p>
          <h2>ארכיון משימות סגורות</h2>
          <p className="subtitle">גריד נפרד למשימות סגורות בלבד, עם חיפוש, קיבוץ ושלבים.</p>
          <div className="tags">
            <span className="tag">Completed</span>
            <span className="tag">DataGrid</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="filters">
          <input
            type="search"
            placeholder="חיפוש חופשי בכותרת/תוכן"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">כל המשתמשים</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
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
        >
          <SearchPanel visible placeholder="חיפוש בגריד..." />
          <FilterRow visible />
          <HeaderFilter visible />
          <GroupPanel visible emptyPanelText="גררו כותרת לכאן לקיבוץ" />
          <Grouping contextMenuEnabled />
          <ColumnChooser enabled />
          <Export enabled allowExportSelectedData />
          <Toolbar>
            <Item name="exportButton" />
            <Item name="searchPanel" />
          </Toolbar>
          <Paging defaultPageSize={10} />

          <Column dataField="title" caption="כותרת" />
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
            cellRender={({ data }) => <StepListCell steps={data.steps || []} />}
          />
        </DataGrid>
      </section>
    </div>
  );
}

const StepListCell = ({ steps }) => (
  <div className="step-inline">
    {steps.map((s) => (
      <div key={s.id} className="step-inline-row">
        <input type="checkbox" checked={!!s.completed} readOnly />
        <span className={s.completed ? 'muted small' : ''}>{s.title}</span>
      </div>
    ))}
    {!steps.length && <span className="muted small">אין שלבים</span>}
  </div>
);

export default CompletedTasksPage;
