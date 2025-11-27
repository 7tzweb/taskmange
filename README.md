📦 התקנה
1️⃣ הורד/שכפל את הפרויקט
git clone https://github.com/7tzweb/taskmange.git


או הורד ZIP ופתח אותו.

2️⃣ עבור לתיקיית הפרויקט
cd taskmange

3️⃣ התקן את כל התלויות — גם ל־server וגם ל־client

הרצה אחת שמתקינה את כל מה שצריך:

npm install
npm install --prefix server
npm install --prefix client

🚀 הרצה משולבת (Client + Server יחד)

בזכות הסקריפט שלך:

"dev": "concurrently -k -n server,client -c magenta,cyan \"npm run dev --prefix server\" \"npm run dev --prefix client\""


אפשר להריץ הכל בפקודה אחת:

npm run dev


וזה יעשה:

מפעיל את השרת (server/index.js) על http://localhost:3000

מפעיל את הלקוח (Vite) על http://localhost:5173

שניהם יפעלו בו־זמנית, עם לוגים בצבעים שונים.

🛠 פקודות שימושיות
הפעלת שרת בלבד
npm run dev:server

הפעלת לקוח בלבד
npm run dev:client

בניית הפרונט־אנד לפרודקשן
npm run build

📁 מבנה הפרויקט
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

❗ דרישות מערכת

Node.js v16+

npm

מערכת שתומכת ב־bash / PowerShell לצורך concurrently