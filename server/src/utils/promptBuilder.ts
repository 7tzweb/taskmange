import { normalizeWhitespace } from './textCleaning.js';

export type ContextChunk = {
  title: string;
  source: string;
  content: string;
};

export type WebResult = {
  title: string;
  url: string;
  snippet: string;
};

export type PromptInput = {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  context: ContextChunk[];
  webResults: WebResult[];
};

export const buildPrompt = ({ question, history, context, webResults }: PromptInput) => {
  const system = normalizeWhitespace(
    `אתה עוזר מוצר בכיר, עונה בעברית בלבד בסגנון אנושי כמו ChatGPT.
    דבר טבעי ונעים, 1-3 משפטים קצרים וברורים.
    אל תכתוב באנגלית, ערבית, סינית או כל שפה אחרת; אם מופיע טקסט זר, תרגם לעברית או השמט.
    הסתמך רק על ההקשרים שסופקו (הערות, מדריכים, משימות, טבלאות, מועדפים). אם אין מידע מספיק, אמור זאת בפשטות.
    אל תמציא עובדות או דוגמאות שלא קיימות בהקשר.`
  );

  const historyBlock = history
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${normalizeWhitespace(msg.content)}`)
    .join('\n');

  const contextBlock = context
    .map((c, idx) => `${idx + 1}. ${c.title} (${c.source})\n${normalizeWhitespace(c.content)}`)
    .join('\n\n');

  const webBlock = webResults
    .map((r, idx) => `${idx + 1}. ${r.title}\n${normalizeWhitespace(r.snippet)}\n${r.url}`)
    .join('\n\n');

  const userPrompt = [
    `שאלה: ${question}`,
    historyBlock ? `היסטוריה:\n${historyBlock}` : '',
    contextBlock ? `הקשר פנימי רלוונטי:\n${contextBlock}` : 'אין הקשר פנימי רלוונטי.',
    webBlock ? `תקציר מידע עדכני מהאינטרנט:\n${webBlock}` : '',
    'הנחיות מענה:',
    '- השב בעברית טבעית בלבד, בלי אנגלית/ערבית/סינית או תעתיק. אם יש טקסט זר, תרגם או השמט.',
    '- ענה רק לפי המידע בקונטקסט; אם חסר מידע, כתוב שאינך יודע.',
    '- אם השאלה מתייחסת לטבלה, פרט מתוך הנתונים: שמות עמודות, מספר שורות, ושורות רלוונטיות או ערכים מבוקשים.',
    '- אם ניתן להסיק מסקנה פשוטה (לדוגמה: מהו הערך הגבוה ביותר, כמה רשומות יש), כתוב אותה ישירות ובקצרה.',
    '- אל תחזור על השאלה, אל תבקש הבהרות אם המידע קיים, ואל תוסיף דוגמאות שלא הופיעו בהקשר.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    system,
    userPrompt,
  };
};
