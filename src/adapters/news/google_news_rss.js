import axios from "axios";
import { isLogVerbose } from "../../lib/env.js";

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
}

/**
 * Google News RSS로 최근 보도 제목 목록
 * @param {string} keyword
 * @param {{ newsHeadlineLimit: number }} config
 * @returns {Promise<string[]>}
 */
export async function fetchRecentIssueHeadlines(keyword, config) {
  const limit = config.newsHeadlineLimit;
  const q = encodeURIComponent(keyword);
  const url = `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;
  const verbose = isLogVerbose();

  try {
    if (verbose) {
      console.log(`    → [News RSS] keyword="${keyword}", limit=${limit}`);
    }
    const { data: xml } = await axios.get(url, {
      timeout: 20000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; dub-auto-title/1.0; +RSS reader)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400,
    });

    const headlines = [];
    const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = itemRe.exec(xml)) !== null && headlines.length < limit) {
      const block = m[1];
      const tm = block.match(
        /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i
      );
      if (!tm) continue;
      const title = decodeXmlEntities(tm[1].trim());
      if (title && !headlines.includes(title)) headlines.push(title);
    }
    if (verbose) {
      console.log(
        `    → [News RSS] extracted ${headlines.length} unique titles`
      );
      if (headlines.length > 0) {
        const sample = headlines.slice(0, 2);
        console.log(`    → [News RSS] sample: ${JSON.stringify(sample)}`);
      }
    }
    return headlines;
  } catch (e) {
    console.warn(`  · 최근 이슈(뉴스) 조회 실패: ${e?.message ?? String(e)}`);
    return [];
  }
}

/**
 * @returns {{ fetchHeadlines: typeof fetchRecentIssueHeadlines }}
 */
export function createGoogleNewsRssSource() {
  return {
    fetchHeadlines: fetchRecentIssueHeadlines,
  };
}
