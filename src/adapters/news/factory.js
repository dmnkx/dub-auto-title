import { createGoogleNewsRssSource } from "./google_news_rss.js";

/**
 * 뉴스/이슈 단서 수집 소스 (추후 다른 RSS/검색 API로 교체 가능)
 * @param {object} config
 * @param {string} [config.newsSourceProvider] 현재는 google_rss 만
 */
export function createNewsSource(config) {
  const provider = String(config.newsSourceProvider ?? "google_rss").toLowerCase();

  if (provider === "google_rss") {
    return createGoogleNewsRssSource();
  }

  throw new Error(
    `지원하지 않는 NEWS_SOURCE_PROVIDER 입니다: ${provider}. (google_rss)`
  );
}
