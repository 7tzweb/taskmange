import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">TaskManage</p>
          <h2>מרכז שליטה למשימות</h2>
          <p className="subtitle">קפצו בין סיכום, יצירה, משתמשים וטמפלייטים – כל עמוד בפני עצמו.</p>
          <div className="tags">
            <span className="tag">RTL</span>
            <span className="tag">DevExtreme</span>
            <span className="tag">LowDB</span>
          </div>
        </div>
        <div className="actions">
          <Link to="/tasks" className="ghost">
            יצירת משימה
          </Link>
          <Link to="/summary" className="ghost">
            סיכום משימות
          </Link>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <p className="eyebrow">סקירה</p>
          <h3>סיכום משימות</h3>
          <p className="subtitle">חיפוש, סינון וקיבוץ לפי משתמשים ותאריכים.</p>
          <Link to="/summary">למעבר לגריד סיכום →</Link>
        </div>
        <div className="card">
          <p className="eyebrow">בניה</p>
          <h3>יצירת משימה / טמפלייט</h3>
          <p className="subtitle">טפסים מהירים, שיוך משתמשים ושלבים.</p>
          <Link to="/tasks">למסך היצירה →</Link>
        </div>
        <div className="card">
          <p className="eyebrow">משתמשים</p>
          <h3>ניהול משתמשים</h3>
          <p className="subtitle">הוספה ועריכה של משתמשים למערכת.</p>
          <Link to="/users">לניהול משתמשים →</Link>
        </div>
        <div className="card">
          <p className="eyebrow">טמפלייטים</p>
          <h3>בניית תהליכי עבודה</h3>
          <p className="subtitle">יצירה ועריכת טמפלייטים עם שלבים קבועים.</p>
          <Link to="/templates">לטמפלייטים →</Link>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
