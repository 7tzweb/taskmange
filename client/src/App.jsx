import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
import InfoPage from './pages/InfoPage.jsx';
import './App.css';

function AppShell() {
  const [dropdownState, setDropdownState] = useState({ tasks: false, guides: false, info: false });
  const navigate = useNavigate();
  const closeTimer = useRef({});

  useEffect(() => {
    config({ rtlEnabled: true });
  }, []);

  const toggleDropdown = (key) => {
    setDropdownState((s) => {
      const next = { tasks: false, guides: false, info: false };
      next[key] = !s[key];
      return next;
    });
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
  const isInfoSection = path.startsWith('/info');

  return (
    <div className="app-shell">
      <nav className="mega-nav">
        <div className="logo">TaskManage</div>
        <ul className="mega-list">
          <li className={`mega-item dropdown ${dropdownState.tasks ? 'open' : ''}`}>
            <div className="mega-trigger-row">
              <NavLink to="/summary" className="mega-trigger" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>
                משימות
              </NavLink>
              <button
                type="button"
                className="caret-btn"
                aria-label="פתח משימות"
                onClick={() => toggleDropdown('tasks')}
              >
                ▾
              </button>
            </div>
            {dropdownState.tasks && (
              <div className="dropdown-menu">
                <NavLink to="/summary" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>סיכום משימות</NavLink>
                <NavLink to="/completed" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>משימות שהושלמו</NavLink>
                <NavLink to="/tasks" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>יצירת משימה</NavLink>
                <NavLink to="/users" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>משתמשים</NavLink>
                <NavLink to="/templates" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>טמפלייטים</NavLink>
              </div>
            )}
          </li>
          <li className={`mega-item dropdown ${dropdownState.guides ? 'open' : ''}`}>
            <div className="mega-trigger-row">
              <NavLink to="/guides" className="mega-trigger" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>
                מדריכים
              </NavLink>
              <button
                type="button"
                className="caret-btn"
                aria-label="פתח מדריכים"
                onClick={() => toggleDropdown('guides')}
              >
                ▾
              </button>
            </div>
            {dropdownState.guides && (
              <div className="dropdown-menu">
                <NavLink to="/guides" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>כל המדריכים</NavLink>
                <NavLink to="/guides/new" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>יצירת מדריך</NavLink>
                <NavLink to="/categories" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>יצירת קטגוריה</NavLink>
              </div>
            )}
          </li>
          <li className={`mega-item dropdown ${dropdownState.info ? 'open' : ''}`}>
            <div className="mega-trigger-row">
              <NavLink to="/info" className="mega-trigger" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>
                מידע
              </NavLink>
              <button
                type="button"
                className="caret-btn"
                aria-label="פתח מידע"
                onClick={() => toggleDropdown('info')}
              >
                ▾
              </button>
            </div>
            {dropdownState.info && (
              <div className="dropdown-menu">
                <NavLink to="/info" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>מידע כללי</NavLink>
                <NavLink to="/info?tab=bot" onClick={() => setDropdownState({ tasks: false, guides: false, info: false })}>הבוט</NavLink>
              </div>
            )}
          </li>
          <li className="mega-item">
            <NavLink to="/services">שירותים</NavLink>
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
          </div>
        )}
        {isGuidesSection && (
          <div className="subnav">
            <NavLink to="/guides">כל המדריכים</NavLink>
            <NavLink to="/guides/new">יצירת מדריך</NavLink>
            <NavLink to="/categories">קטגוריות</NavLink>
          </div>
        )}
        {isInfoSection && (
          <div className="subnav">
            <NavLink to="/info">מידע כללי</NavLink>
            <NavLink to="/info?tab=bot">הבוט</NavLink>
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
          <Route path="/info" element={<InfoPage />} />
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
