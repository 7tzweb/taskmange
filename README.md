# TaskMange

מדריך התקנה והרצה של הפרויקט (Client + Server)

---

## 📦 1. הורדה / שכפול הפרויקט

```sh
git clone https://github.com/7tzweb/taskmange.git
```

או הורד ZIP ופתח אותו.

---

## 📁 2. מעבר לתיקיית הפרויקט

```sh
cd taskmange
```

---

## 🐳 3. הרצה מלאה עם Docker (מומלץ)

1) ודא ש‑Docker מותקן ורץ.  
2) ערוך את קובץ `.env` (ברוט) לפי הצורך. ברירת המחדל מכוונת ל‑PostgreSQL/Redis בקומפוז.

הרצה:
```sh
docker-compose up --build -d
```

לאחר שהשירותים עלו, הרץ מיגרציות וייבוא נתונים (אופציונלי):
```sh
# החלת סכימה על PostgreSQL
docker-compose run --rm node_api npx prisma migrate deploy

# ייבוא נתוני db.json ל‑PostgreSQL
docker-compose run --rm node_api npm run import:data
```

נקודות גישה:
- API: http://localhost:4000  
- Client (Vite): http://localhost:5173  
- PgAdmin: http://localhost:8080 (admin@admin.com / admin)  
- Redis: localhost:6379

עצירה:
```sh
docker-compose down
```

---

## 🔧 4. התקנה מקומית (ללא Docker) – שרת + לקוח

הרצה אחת שמתקינה את כל מה שצריך:

```sh
npm install
npm install --prefix server
npm install --prefix client
```

---

## 🚀 5. הרצה משולבת (Client + Server ביחד)

הפרויקט מוגדר עם הסקריפט הבא:

```json
"dev": "concurrently -k -n server,client -c magenta,cyan \"npm run dev --prefix server\" \"npm run dev --prefix client\""
```

להריץ הכול בפקודה אחת:

```sh
npm run dev
```

### מה זה עושה?

- מפעיל את השרת על:  
  **http://localhost:4000**

- מפעיל את הלקוח (Vite) על:  
  **http://localhost:5173**

שניהם ירוצו יחד, עם לוגים בצבעים שונים.

---

## 🛠 פקודות שימושיות

### הרצת שרת בלבד
```sh
npm run dev:server
```

### הרצת לקוח בלבד
```sh
npm run dev:client
```

### בניית הפרונטאנד לפרודקשן
```sh
npm run build
```

---

## 🧱 מבנה הפרויקט

```
taskmange/
 ├── client/                 # Frontend (Vite)
 ├── server/                 # Backend (Express + Prisma)
 │   ├── prisma/             # סכימת Prisma + מיגרציות
 │   ├── generated/prisma    # Prisma Client
 │   ├── import-data.js      # ייבוא db.json ל‑Postgres
 │   └── db.json             # נתוני מקור לייבוא
 ├── docker/                 # Dockerfiles לשרת/לקוח
 ├── docker-compose.yml      # orkestration: api + client + postgres + redis + pgadmin
 ├── .env                    # משתני סביבה (API/DB/Redis)
 └── README.md
```

---

## ✔ סיימת!

עכשיו כל מה שצריך זה להריץ:

```sh
npm run dev
```

והפרונטאנד והבקאנד יפעלו ביחד.
