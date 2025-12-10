export const stripHtml = (html: string = '') =>
  html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeWhitespace = (text: string = '') => (text || '').replace(/\s+/g, ' ').trim();

export const chunkText = (text: string, chunkSize = 700, overlap = 80): string[] => {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + chunkSize);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - overlap;
  }
  return chunks;
};

// Keep only Hebrew letters, digits, basic punctuation and whitespace.
export const sanitizeHebrew = (text: string = '') => {
  if (!text) return '';
  return normalizeWhitespace(text.replace(/[^\u0590-\u05FF0-9 .,;:!?()\[\]{}"'״׳\/\-\n]+/g, ' '));
};
