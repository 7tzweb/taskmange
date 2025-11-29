import { useEffect, useMemo, useState } from 'react';
import DataGrid, {
  Column,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Paging,
  GroupPanel,
  Grouping,
  ColumnChooser,
  Export,
  Toolbar,
  Item,
} from 'devextreme-react/data-grid';
import { fetchGuides, fetchCategories } from '../api.js';
import { useNavigate } from 'react-router-dom';

function GuidesListPage() {
  const [guides, setGuides] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewGuide, setViewGuide] = useState(null);
  const navigate = useNavigate();

  const categoryMap = useMemo(
    () =>
      categories.reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {}),
    [categories]
  );

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [cats, gds] = await Promise.all([fetchCategories(), fetchGuides()]);
    setCategories(cats);
    setGuides(gds);
    setLoading(false);
  };

  const filteredGuides = useMemo(() => {
    if (!search) return guides;
    return guides.filter(
      (g) =>
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        (g.categoryName || '').toLowerCase().includes(search.toLowerCase()) ||
        (g.content || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [guides, search]);

  const openGuide = (guide) => setViewGuide(guide);
  const closeGuide = () => setViewGuide(null);
  const handleEdit = (id) => navigate(`/guides/new?id=${id}`);

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">מדריכים</p>
          <h2>כל המדריכים</h2>
          <p className="subtitle">חיפוש עמוק בכותרת, קטגוריה ותוכן CKEditor.</p>
          <div className="tags">
            <span className="tag">Search</span>
            <span className="tag">Filter</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">רשימת מדריכים</p>
            <h3>DataGrid עם חיפוש עמוק</h3>
          </div>
          <input
            type="search"
            placeholder="חיפוש לפי כותרת / קטגוריה / תוכן"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DataGrid
          dataSource={filteredGuides}
          keyExpr="id"
          rtlEnabled
          rowAlternationEnabled
          allowColumnReordering
          allowColumnResizing
          columnAutoWidth
          showBorders={false}
          loadPanel={{ enabled: loading }}
          sorting={{ mode: 'multiple' }}
          onExporting={() => {}}
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
            dataField="categoryId"
            caption="קטגוריה"
            calculateDisplayValue={(row) => categoryMap[row.categoryId] || row.categoryName || '—'}
          />
          <Column dataField="createdAt" caption="תאריך יצירה" dataType="date" />
          <Column dataField="updatedAt" caption="תאריך עדכון" dataType="date" />
          <Column
            caption="פעולות"
            width={160}
            cellRender={({ data }) => (
              <div className="actions inline-actions">
                <button type="button" className="ghost action-pill" onClick={() => openGuide(data)} title="צפייה">
                  👁️
                </button>
                <button type="button" className="ghost action-pill" onClick={() => handleEdit(data.id)} title="עריכה">
                  ✏️
                </button>
              </div>
            )}
          />
        </DataGrid>
      </section>

      {viewGuide && (
        <div className="modal-backdrop">
          <div className="modal modal-wide">
            <div className="card-head">
              <div>
                <p className="eyebrow">{categoryMap[viewGuide.categoryId] || viewGuide.categoryName || 'ללא קטגוריה'}</p>
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

export default GuidesListPage;
