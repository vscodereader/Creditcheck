import axios from 'axios';
import * as cheerio from 'cheerio';

const GACHON_CATALOG_URL = 'https://www.gachon.ac.kr/kor/1097/subview.do';

export type ScrapedSource = {
  title: string;
  sourceUrl: string;
  publishedAt: Date | null;
  year: number | null;
  category: 'major' | 'general';
};

export async function fetchGachonSources(): Promise<ScrapedSource[]> {
  const response = await axios.get(GACHON_CATALOG_URL, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const $ = cheerio.load(response.data);
  const results = new Map<string, ScrapedSource>();

  $('a').each((_, element) => {
    const href = $(element).attr('href')?.trim();
    const text = $(element).text().replace(/\s+/g, ' ').trim();

    if (!href || !text) return;
    if (!href.includes('ibook.gachon.ac.kr')) return;
    if (!/(총람|교육과정)/.test(text)) return;

    const match = text.match(/(?<year>\d{4})\.(?<month>\d{2})\.(?<day>\d{2})\s+(?<title>.+)/);
    const title = match?.groups?.title?.trim() ?? text;
    const year = match?.groups?.year ? Number(match.groups.year) : extractYear(title);
    const publishedAt =
      match?.groups?.year && match?.groups?.month && match?.groups?.day
        ? new Date(`${match.groups.year}-${match.groups.month}-${match.groups.day}T00:00:00+09:00`)
        : null;

    results.set(href, {
      title,
      sourceUrl: href,
      publishedAt,
      year,
      category: title.includes('전공') ? 'major' : 'general'
    });
  });

  return [...results.values()].sort((a, b) => {
    const aTime = a.publishedAt?.getTime() ?? 0;
    const bTime = b.publishedAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

function extractYear(text: string): number | null {
  const match = text.match(/(20\d{2})/);
  return match ? Number(match[1]) : null;
}

export { GACHON_CATALOG_URL };
