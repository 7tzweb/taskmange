import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import config from 'devextreme/core/config';
import HomePage from './pages/HomePage.jsx';
import CreateTaskPage from './pages/CreateTaskPage.jsx';
import SummaryPage from './pages/SummaryPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import CompletedTasksPage from './pages/CompletedTasksPage.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import GuidesListPage from './pages/GuidesListPage.jsx';
import GuideCreatePage from './pages/GuideCreatePage.jsx';
import CategoryCreatePage from './pages/CategoryCreatePage.jsx';
import './App.css';

function AppShell() {
  const [dropdownState, setDropdownState] = useState({ tasks: false, guides: false });
  const closeTimer = useRef({});

  useEffect(() => {
    config({ rtlEnabled: true });
  }, []);

  const openDropdown = (key) => {
    if (closeTimer.current[key]) clearTimeout(closeTimer.current[key]);
    setDropdownState((s) => ({ ...s, [key]: true }));
  };

  const scheduleCloseDropdown = (key) => {
    if (closeTimer.current[key]) clearTimeout(closeTimer.current[key]);
    closeTimer.current[key] = setTimeout(() => setDropdownState((s) => ({ ...s, [key]: false })), 200);
  };

  const location = useLocation();
  const path = location.pathname;
  const isTasksSection =
    path === '/' ||
    path.startsWith('/summary') ||
    path.startsWith('/completed') ||
    path.startsWith('/tasks') ||
    path.startsWith('/users') ||
    path.startsWith('/templates');
  const isGuidesSection = path.startsWith('/guides') || path.startsWith('/categories');

  return (
    <div className="app-shell">
      <nav className="mega-nav">
        <div className="logo">TaskManage</div>
        <ul className="mega-list">
          <li
            className={`mega-item dropdown ${dropdownState.tasks ? 'open' : ''}`}
            onMouseEnter={() => openDropdown('tasks')}
            onMouseLeave={() => scheduleCloseDropdown('tasks')}
          >
            <button type="button" onClick={() => setDropdownState((s) => ({ ...s, tasks: !s.tasks }))}>
              משימות ▾
            </button>
            <div className="dropdown-menu">
              <NavLink to="/summary">סיכום משימות</NavLink>
              <NavLink to="/completed">משימות שהושלמו</NavLink>
              <NavLink to="/tasks">יצירת משימה</NavLink>
              <NavLink to="/users">משתמשים</NavLink>
              <NavLink to="/templates">טמפלייטים</NavLink>
            </div>
          </li>
          <li
            className={`mega-item dropdown ${dropdownState.guides ? 'open' : ''}`}
            onMouseEnter={() => openDropdown('guides')}
            onMouseLeave={() => scheduleCloseDropdown('guides')}
          >
            <button type="button" onClick={() => setDropdownState((s) => ({ ...s, guides: !s.guides }))}>
              מדריכים ▾
            </button>
            <div className="dropdown-menu">
              <NavLink to="/guides">כל המדריכים</NavLink>
              <NavLink to="/guides/new">יצירת מדריך</NavLink>
              <NavLink to="/categories">יצירת קטגוריה</NavLink>
            </div>
          </li>
          <li className="mega-item">
            <NavLink to="/services">שירותים</NavLink>
          </li>
          <li className="mega-item">
            <NavLink to="/info">מידע</NavLink>
          </li>
          <li className="mega-item">
            <NavLink to="/tools">כלי עזר</NavLink>
          </li>
          <li className="mega-item">
            <NavLink to="/favorites">מועדפים</NavLink>
          </li>
        </ul>
      </nav>

      <header className="topbar">
        <div className="topbar-left">
          <p className="eyebrow">🧭 TaskManage</p>
          <h1>מערכת משימות מודרנית</h1>
          <p className="subtitle">
            יצירת משימות תוך שניות, עם טמפלייטים, ניהול משתמשים וגרידים של DevExpress.
          </p>
        </div>
        <div className="topbar-subnav">
          {isTasksSection && (
            <div className="subnav">
              <NavLink to="/summary">סיכום משימות</NavLink>
              <NavLink to="/completed">משימות שהושלמו</NavLink>
              <NavLink to="/tasks">יצירת משימה</NavLink>
              <NavLink to="/users">משתמשים</NavLink>
              <NavLink to="/templates">טמפלייטים</NavLink>
              <NavLink to="/">בית</NavLink>
            </div>
          )}
          {isGuidesSection && (
            <div className="subnav">
              <NavLink to="/guides">כל המדריכים</NavLink>
              <NavLink to="/guides/new">יצירת מדריך</NavLink>
              <NavLink to="/categories">קטגוריות</NavLink>
            </div>
          )}
        </div>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tasks" element={<CreateTaskPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/completed" element={<CompletedTasksPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/guides" element={<GuidesListPage />} />
          <Route path="/guides/new" element={<GuideCreatePage />} />
          <Route path="/categories" element={<CategoryCreatePage />} />
          <Route path="/services" element={<ComingSoon title="שירותים" />} />
          <Route path="/info" element={<ComingSoon title="מידע" />} />
          <Route path="/tools" element={<ComingSoon title="כלי עזר" />} />
          <Route path="/favorites" element={<ComingSoon title="מועדפים" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
