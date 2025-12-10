# TaskMange

מדריך תפעול בשלושה חלקים: הרצה (Docker מקומי), התקנה (עם/בלי Docker), והעלאה לייצור (עם/בלי Docker).

---

## 1) איך להריץ מקומית עם Docker מותקן
דרישות: Docker + Docker Compose מותקנים ורצים.
```sh
cd taskmange
docker compose up --build -d      # מריץ API + Client + Postgres + Redis + PgAdmin
docker compose run --rm node_api npx prisma migrate deploy   # מיגרציות
# אופציונלי: ייבוא נתוני דוגמה
docker compose run --rm node_api npm run import:data
```
נקודות גישה:
- API: http://localhost:4000  
- Client (Vite): http://localhost:5173  
- PgAdmin: http://localhost:8080 (admin@admin.com / admin)

עצירה:
```sh
docker compose down
```

---

## 2) איך להתקין את הפרויקט
### א. עם Docker (התקנה = הפעלה)
אין התקנה נפרדת: מריצים את הפקודות מהסעיף הקודם (`docker compose up --build -d`), ואז מיגרציות וייבוא נתונים לפי הצורך.

### ב. בלי Docker (Node + DB/Redis מותקנים מקומית)
```sh
cd taskmange
npm install                 # בשורש (concurrently)
npm install --prefix server
npm install --prefix client
# הגדר .env ב-server לדאטהבייס/רדיס מקומיים (DATABASE_URL, REDIS_URL, OLLAMA_HOST וכו')
npm run dev                 # מפעיל שרת + לקוח יחד
```
- API: http://localhost:4000  
- Client: http://localhost:5173  
עצירה: `Ctrl+C`.  
אם צריך בנפרד: `npm run dev:server` או `npm run dev:client`.

---

## 3) איך להעלות לייצור (שרת לינוקס)
### א. עם Docker (מומלץ)
```sh
git clone <repo> && cd taskmange      # או העתקה אחרת של הקבצים
cp .env.example .env                  # אם יש; לעדכן חיבורי DB/Redis/Ollama
docker compose up --build -d
docker compose run --rm node_api npx prisma migrate deploy
# אופציונלי: ייבוא db.json
docker compose run --rm node_api npm run import:data
```
חשיפה:
- API על פורט 4000 (עטפו ב‑NGINX ל‑443 אם צריך)
- Client על פורט 5173 (או שימו reverse proxy / build סטטי)
עצירה/עדכון:
```sh
docker compose down           # עצירה
docker compose pull && docker compose up -d   # עדכון תמונות והרצה
```

### ב. בלי Docker
1. התקן Node.js 20+, PostgreSQL, Redis על השרת.
2. `git clone <repo> && cd taskmange`
3. התקנות:
   ```sh
   npm install
   npm install --prefix server
   npm install --prefix client
   ```
4. הגדר משתני סביבה ב-`.env` (DATABASE_URL, REDIS_URL, OLLAMA_HOST, OLLAMA_MODEL).
5. מיגרציות + ייבוא:
   ```sh
   cd server
   npx prisma migrate deploy
   npm run import:data   # אופציונלי
   cd ..
   ```
6. בניית פרונט:
   ```sh
   npm run build --prefix client
   ```
   הגשו את `client/dist` עם NGINX/Apache או `npx serve client/dist`.
7. הרצת שרת בפרודקשן:
   ```sh
   npm run build --prefix server    # קומפילציה ל-dist
   npm run start --prefix server    # node dist/index.js
   ```
   מומלץ לעטוף ב‑PM2/systemd + פרוקסי NGINX ל‑HTTPS.

---

## מבנה הפרויקט (עיקרי)
```
taskmange/
 ├─ client/                  # פרונט (Vite + React)
 │   ├─ src/features/...     # מסכים לפי תחום (tasks, guides, tools וכו')
 │   ├─ src/components/      # רכיבים משותפים
 │   └─ src/api.js           # קריאות API
 ├─ server/                  # בקאנד (Express + Prisma)
 │   ├─ index.ts             # נקודת כניסה
 │   ├─ prisma/              # סכימת Prisma
 │   └─ import-data.js       # ייבוא db.json
 ├─ docker/                  # Dockerfiles
 ├─ docker-compose.yml       # orkestration (api + client + postgres + redis + pgadmin)
 └─ README.md
```
