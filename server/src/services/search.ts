// @ts-nocheck
import fetch from 'node-fetch';
import { normalizeWhitespace } from '../utils/textCleaning.js';
import { WebResult } from '../utils/promptBuilder.js';

const SERPER_API = 'https://google.serper.dev/search';

export const shouldUseWeb = (question: string) => {
  const lower = question.toLowerCase();
  const opinionWords = ['מה דעתך', 'מה אתה חושב', 'איך היית', 'מומלץ', 'השוואה', 'טוב יותר', 'עדכני', 'חדש'];
  return opinionWords.some((w) => lower.includes(w));
};

export const webSearch = async (query: string, limit = 4): Promise<WebResult[]> => {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  try {
    const response = await fetch(SERPER_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ q: query, num: limit }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const results = data.organic || [];
    return results.slice(0, limit).map((item: any) => ({
      title: item.title || 'תוצאה ללא כותרת',
      url: item.link,
      snippet: normalizeWhitespace(item.snippet || item.description || ''),
    }));
  } catch {
    return [];
  }
};
