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

## 🔧 3. התקנת כל התלויות (שרת + לקוח)

הרצה אחת שמתקינה את כל מה שצריך:

```sh
npm install
npm install --prefix server
npm install --prefix client
```

---

## 🚀 4. הרצה משולבת (Client + Server ביחד)

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
  **http://localhost:3000**

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
 ├── client/           # Frontend (Vite)
 │   ├── src/
 │   ├── public/
 │   ├── package.json
 │   └── vite.config.js
 │
 ├── server/           # Backend (Node.js + Express)
 │   ├── index.js
 │   ├── db.json
 │   ├── nodemon.json
 │   └── package.json
 │
 ├── package.json      # הפעלה משולבת
 └── README.md
```

---

## ✔ סיימת!

עכשיו כל מה שצריך זה להריץ:

```sh
npm run dev
```

והפרונטאנד והבקאנד יפעלו ביחד.
