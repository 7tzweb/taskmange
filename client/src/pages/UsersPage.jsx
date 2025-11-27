import { useEffect, useState } from 'react';
import { fetchUsers, createUser, updateUser } from '../api.js';

const emptyUser = { id: '', name: '', email: '' };

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState(emptyUser);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await fetchUsers();
    setUsers(data);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    if (!userForm.name) return;
    if (userForm.id) {
      await updateUser(userForm.id, userForm);
    } else {
      await createUser(userForm);
    }
    setUserForm(emptyUser);
    loadUsers();
  };

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <p className="eyebrow">משתמשים</p>
          <h2>ניהול משתמשים</h2>
          <p className="subtitle">הוספה ועריכה של משתמשים, לשיוך מהיר למשימות.</p>
        </div>
      </section>

      <section className="card">
        <form onSubmit={saveUser} className="stack">
          <div className="card-head">
            <div>
              <p className="eyebrow">טופס משתמש</p>
              <h3>{userForm.id ? 'עריכת משתמש' : 'יצירת משתמש'}</h3>
            </div>
            <button type="submit">{userForm.id ? 'שמור משתמש' : 'הוסף משתמש'}</button>
          </div>

          <div className="form-grid">
            <label>
              שם
              <input
                type="text"
                value={userForm.name}
                onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="רות כהן"
              />
            </label>
            <label>
              אימייל
              <input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="user@email.com"
              />
            </label>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="template-list compact">
          {users.map((u) => (
            <div key={u.id} className="template-row">
              <div>
                <strong>{u.name}</strong>
                <p className="muted small">{u.email || 'אין אימייל'}</p>
              </div>
              <button type="button" className="ghost" onClick={() => setUserForm(u)}>
                ערוך
              </button>
            </div>
          ))}
          {users.length === 0 && <p className="muted">עוד לא נוספו משתמשים.</p>}
        </div>
      </section>
    </div>
  );
}

export default UsersPage;
