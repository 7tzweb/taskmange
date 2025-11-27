import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import config from 'devextreme/core/config';
import HomePage from './pages/HomePage.jsx';
import CreateTaskPage from './pages/CreateTaskPage.jsx';
import SummaryPage from './pages/SummaryPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import CompletedTasksPage from './pages/CompletedTasksPage.jsx';
import './App.css';

function App() {
  useEffect(() => {
    config({ rtlEnabled: true });
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">🧭 TaskManage</p>
            <h1>מערכת משימות מודרנית</h1>
            <p className="subtitle">
              יצירת משימות תוך שניות, עם טמפלייטים, ניהול משתמשים וגרידים של DevExpress.
            </p>
          </div>
          <nav className="nav">
            <NavLink to="/" end>
              בית
            </NavLink>
            <NavLink to="/summary">סיכום משימות</NavLink>
            <NavLink to="/completed">משימות שהושלמו</NavLink>
            <NavLink to="/tasks">יצירת משימה</NavLink>
            <NavLink to="/users">משתמשים</NavLink>
            <NavLink to="/templates">טמפלייטים</NavLink>
          </nav>
        </header>

        <main className="page">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tasks" element={<CreateTaskPage />} />
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/completed" element={<CompletedTasksPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
