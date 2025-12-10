import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import config from 'devextreme/core/config';
import HomePage from './features/home/HomePage.jsx';
import CreateTaskPage from './features/tasks/CreateTaskPage.jsx';
import SummaryPage from './features/tasks/SummaryPage.jsx';
import UsersPage from './features/users/UsersPage.jsx';
import TemplatesPage from './features/templates/TemplatesPage.jsx';
import CompletedTasksPage from './features/tasks/CompletedTasksPage.jsx';
import ComingSoon from './features/common/ComingSoon.jsx';
import ToolsPage from './features/tools/ToolsPage.jsx';
import GuidesListPage from './features/guides/GuidesListPage.jsx';
import GuideCreatePage from './features/guides/GuideCreatePage.jsx';
import CategoryCreatePage from './features/categories/CategoryCreatePage.jsx';
import InfoPage from './features/info/InfoPage.jsx';
import FavoritesPage from './features/favorites/FavoritesPage.jsx';
import ServicesPage from './features/services/ServicesPage.jsx';
import './App.css';

function AppShell() {
  const [dropdownState, setDropdownState] = useState({ tasks: false, guides: false, info: false, services: false });
  const navigate = useNavigate();
  const closeTimer = useRef({});

  useEffect(() => {
    config({ rtlEnabled: true });
  }, []);

  const toggleDropdown = (key) => {
    setDropdownState((s) => {
      const next = { tasks: false, guides: false, info: false, services: false };
      next[key] = !s[key];
      return next;
    });
  };

  const location = useLocation();
  const path = location.pathname;
  const currentInfoTab = (() => {
    if (!path.startsWith('/info')) return '';
    const params = new URLSearchParams(location.search || '');
    return params.get('tab') || 'general';
  })();
  const isTasksSection =
    path === '/' ||
    path.startsWith('/summary') ||
    path.startsWith('/completed') ||
    path.startsWith('/tasks') ||
    path.startsWith('/users') ||
    path.startsWith('/templates');
  const isGuidesSection = path.startsWith('/guides') || path.startsWith('/categories');
  const isInfoSection = path.startsWith('/info');
  const isServicesSection = path.startsWith('/services');

  const renderSubnav = () => {
    if (isTasksSection) {
      return (
        <div className="topbar-subnav">
          <NavLink to="/summary">סיכום משימות</NavLink>
          <NavLink to="/completed">משימות שהושלמו</NavLink>
          <NavLink to="/tasks">יצירת משימה</NavLink>
          <NavLink to="/users">משתמשים</NavLink>
          <NavLink to="/templates">טמפלייטים</NavLink>
        </div>
      );
    }
    if (isGuidesSection) {
      return (
        <div className="topbar-subnav">
          <NavLink to="/guides">כל המדריכים</NavLink>
          <NavLink to="/guides/new">יצירת מדריך</NavLink>
          <NavLink to="/categories">קטגוריות</NavLink>
        </div>
      );
    }
    if (isInfoSection) {
      return (
        <div className="topbar-subnav">
          <NavLink
            to="/info"
            className={({ isActive }) => (isActive && currentInfoTab === 'general' ? 'active' : '')}
          >
            מידע כללי
          </NavLink>
          <NavLink
            to="/info?tab=tables"
            className={() => (currentInfoTab === 'tables' ? 'active' : '')}
          >
            יצירת טבלאות
          </NavLink>
          <NavLink to="/info?tab=bot" className={() => (currentInfoTab === 'bot' ? 'active' : '')}>
            הבוט
          </NavLink>
        </div>
      );
    }
    if (isServicesSection) {
      return (
        <div className="topbar-subnav">
          <NavLink to="/services">שירותים</NavLink>
          <span className="pill-disabled">לוגים (בקרוב)</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-shell">
      <nav className="mega-nav">
        <div className="logo">TaskManage</div>
        <ul className="mega-list">
          <li className={`mega-item dropdown ${dropdownState.tasks ? 'open' : ''}`}>
            <div className="mega-trigger-row">
              <NavLink to="/summary" className="mega-trigger" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>
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
                <NavLink to="/summary" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>סיכום משימות</NavLink>
                <NavLink to="/completed" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>משימות שהושלמו</NavLink>
                <NavLink to="/tasks" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>יצירת משימה</NavLink>
                <NavLink to="/users" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>משתמשים</NavLink>
                <NavLink to="/templates" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>טמפלייטים</NavLink>
              </div>
            )}
          </li>
          <li className={`mega-item dropdown ${dropdownState.guides ? 'open' : ''}`}>
            <div className="mega-trigger-row">
              <NavLink to="/guides" className="mega-trigger" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>
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
                <NavLink to="/guides" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>כל המדריכים</NavLink>
                <NavLink to="/guides/new" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>יצירת מדריך</NavLink>
                <NavLink to="/categories" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>יצירת קטגוריה</NavLink>
              </div>
            )}
          </li>
          <li className={`mega-item dropdown ${dropdownState.info ? 'open' : ''}`}>
            <div className="mega-trigger-row">
              <NavLink to="/info" className="mega-trigger" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>
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
                <NavLink to="/info" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>מידע כללי</NavLink>
                <NavLink to="/info?tab=bot" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>הבוט</NavLink>
              </div>
            )}
          </li>
          <li className={`mega-item dropdown ${dropdownState.services ? 'open' : ''}`}>
            <div className="mega-trigger-row">
              <NavLink to="/services" className="mega-trigger" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>
                שירותים
              </NavLink>
              <button
                type="button"
                className="caret-btn"
                aria-label="פתח שירותים"
                onClick={() => toggleDropdown('services')}
              >
                ▾
              </button>
            </div>
            {dropdownState.services && (
              <div className="dropdown-menu">
                <NavLink to="/services" onClick={() => setDropdownState({ tasks: false, guides: false, info: false, services: false })}>בדיקות שירותים</NavLink>
              </div>
            )}
          </li>
          <li className="mega-item">
            <NavLink to="/tools">כלי עזר</NavLink>
          </li>
          <li className="mega-item">
            <NavLink to="/favorites">מועדפים</NavLink>
          </li>
        </ul>
      </nav>

      {(isTasksSection || isGuidesSection || isInfoSection || isServicesSection) && (
        <header className="topbar">
          {renderSubnav()}
        </header>
      )}

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
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
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
