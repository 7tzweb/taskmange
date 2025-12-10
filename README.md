# TaskMange

שלושה חלקים קצרים: הרצה, התקנה, והעלאה לייצור (לינוקס).

---

## 1) איך להריץ (פיתוח)
דרישות: Node.js 20+, npm.
```sh
cd taskmange
npm install         # שורש (concurrently)
npm install --prefix server
npm install --prefix client

npm run dev         # מפעיל שרת + לקוח יחד
```
- API: http://localhost:4000  
- Vite: http://localhost:5173  
עצירה: `Ctrl+C`.

אם צריך בנפרד:
- שרת בלבד: `npm run dev:server`
- לקוח בלבד: `npm run dev:client`

---

## 2) איך להתקין (ללא Docker)
```sh
cd taskmange
npm install
npm install --prefix server
npm install --prefix client
# ריצה מקומית: npm run dev
# בניית פרונט: npm run build --prefix client
```
בדוק קובץ `.env` בשרת אם צריך לשנות חיבורי DB/Redis/Ollama.

---

## 3) איך להעלות לייצור (שרת לינוקס)
דרך מומלצת: Docker Compose.

1. התקן Docker + Docker Compose.
2. העבר את קבצי הפרויקט לשרת (git clone או העתקה).
3. הגדר `.env` ברוט (URLים של DB/Redis/Ollama). ברירת מחדל מכוונת לשירותי ה‑compose.
4. הרם את הסטאק:
   ```sh
   docker compose up --build -d
   ```
5. החלת סכימה על PostgreSQL:
   ```sh
   docker compose run --rm node_api npx prisma migrate deploy
   ```
6. (אופציונלי) ייבוא נתוני הדגמה מ‑db.json:
   ```sh
   docker compose run --rm node_api npm run import:data
   ```

נקודות גישה בייצור (ברירת מחדל):
- API: http://<server-ip>:4000  
- Client (Vite dev server, אפשר לעטוף ב‑NGINX ל‑443): http://<server-ip>:5173  
- PgAdmin: http://<server-ip>:8080 (admin@admin.com / admin)

עצירת הסטאק:
```sh
docker compose down
```

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
