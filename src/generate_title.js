import axios from "axios";
import { readFileSync } from "fs";
import path from "path";
import { projectRoot } from "./config.js";
import {
  MIN_TITLE_LENGTH,
  buildPromptFromIssues,
  buildRegenerateHint,
} from "./prompts.js";

const keywords = JSON.parse(
  readFileSync(path.join(projectRoot, "config", "keywords.json"), "utf8")
);

/**
 * @typedef {object} AppConfig
 * @property {string} geminiApiKey
 * @property {string} geminiModel
 * @property {number} geminiRetryMax
 * @property {number} geminiRetryBaseMs
 * @property {number} delayBetweenKeywordsMs
 * @property {number} geminiMaxOutputTokens
 * @property {number} newsHeadlineLimit
 */

const MAX_BACKOFF_MS = 120_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini 429/502/503 시 재시도 (지수 백오프, Retry-After 반영)
 * @param {string} url
 * @param {object} payload
 * @param {AppConfig} config
 */
async function callGeminiGenerateContent(url, payload, config) {
  const extraRetries = Math.max(0, Number(config.geminiRetryMax) || 0);
  const maxAttempts = 1 + extraRetries;
  const baseMs = Math.max(500, Number(config.geminiRetryBaseMs) || 2000);

  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { data } = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
      });
      return data;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const retryable = status === 429 || status === 503 || status === 502;
      if (!retryable || attempt >= maxAttempts - 1) {
        if (status === 429) {
          const detail =
            err.response?.data?.error?.message ||
            err.response?.data?.error ||
            "";
          throw new Error(
            `Gemini API 요청 한도(429)에 걸렸습니다. ${detail ? `${detail} ` : ""}잠시 후 다시 실행하거나, config의 delayBetweenKeywordsMs·geminiRetryBaseMs를 늘리거나 무료 한도를 확인하세요.`
          );
        }
        throw err;
      }

      const ra = err.response?.headers?.["retry-after"];
      let waitMs = ra
        ? Math.max(parseInt(ra, 10) * 1000, baseMs)
        : baseMs * Math.pow(2, attempt);
      waitMs = Math.min(waitMs, MAX_BACKOFF_MS);

      console.warn(
        `    → Gemini HTTP ${status}, ${Math.ceil(waitMs / 1000)}초 대기 후 재시도 (${attempt + 1}/${extraRetries})`
      );
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

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
 * 키워드로 Google 뉴스 RSS를 조회해 최근 보도 제목 목록을 만든다.
 * @param {string} keyword
 * @param {AppConfig} config
 * @returns {Promise<string[]>}
 */
export async function fetchRecentIssueHeadlines(keyword, config) {
  const limit = config.newsHeadlineLimit;
  const q = encodeURIComponent(keyword);
  const url = `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;

  try {
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
      let title = decodeXmlEntities(tm[1].trim());
      if (title && !headlines.includes(title)) headlines.push(title);
    }
    return headlines;
  } catch (e) {
    console.warn(`  · 최근 이슈(뉴스) 조회 실패: ${e.message}`);
    return [];
  }
}

function parseTitlesFromText(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]?\s*\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);
}

function isPlausibleTitle(s) {
  const t = s.trim();
  if (t.length < MIN_TITLE_LENGTH) return false;
  // 끊긴 한 줄: 매우 짧고 쉼표/초점으로만 끝남
  if (t.length < MIN_TITLE_LENGTH + 4 && /^(.{2,25})[，,、…]\s*$/.test(t)) {
    return false;
  }
  return true;
}

/**
 * 모델 응답에서 제목 5개 추출. JSON 배열 우선, 실패 시 줄 단위(검증 후).
 * @param {string} text
 * @returns {string[]}
 */
function extractJsonArrayString(text) {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const bracket = s.match(/\[[\s\S]*\]/);
  return bracket ? bracket[0] : null;
}

function parseTitlesFromResponse(text) {
  const raw = text.trim();
  const jsonSlice = extractJsonArrayString(raw);

  if (jsonSlice) {
    try {
      const arr = JSON.parse(jsonSlice);
      if (Array.isArray(arr)) {
        const out = arr
          .map((x) => String(x).replace(/\r?\n/g, " ").trim())
          .filter(isPlausibleTitle);
        if (out.length >= 5) return out.slice(0, 5);
      }
    } catch {
      /* fallthrough */
    }
  }

  return parseTitlesFromText(raw).filter(isPlausibleTitle).slice(0, 5);
}

/**
 * @param {string} keyword
 * @param {AppConfig} config
 */
async function generateTitle(keyword, config) {
  const headlines = await fetchRecentIssueHeadlines(keyword, config);
  if (headlines.length > 0) {
    console.log(`    → 최근 뉴스 ${headlines.length}건 반영`);
  } else {
    console.log(`    → 뉴스 없음, 시의성 가정으로 생성`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

  const baseOutTok = Math.min(
    8192,
    Math.max(1024, Number(config.geminiMaxOutputTokens) || 8192)
  );

  let basePrompt = buildPromptFromIssues(keyword, headlines);
  let titles = [];
  /** @type {string | undefined} */
  let lastFinishReason;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt === 1) {
      console.warn("    → 제목이 5개 미만이거나 너무 짧아 1회 재생성");
      basePrompt = buildPromptFromIssues(keyword, headlines) + buildRegenerateHint();
    } else if (attempt === 2) {
      console.warn("    → 출력이 잘렸을 수 있어 maxOutputTokens 상한으로 1회 재시도");
      basePrompt =
        buildPromptFromIssues(keyword, headlines) +
        `\n\n**재시도**: 출력이 중간에 끊기지 않게 JSON 배열만 간결히 완성하라.`;
    }

    const bumpTokens = attempt === 2 || lastFinishReason === "MAX_TOKENS";
    const maxOutputTokens = bumpTokens ? 8192 : baseOutTok;

    const data = await callGeminiGenerateContent(
      url,
      {
        contents: [{ parts: [{ text: basePrompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature: attempt === 0 ? 0.55 : 0.45,
          responseMimeType: "application/json",
        },
      },
      config
    );

    const cand = data?.candidates?.[0];
    lastFinishReason = cand?.finishReason;
    if (lastFinishReason && lastFinishReason !== "STOP") {
      console.warn(`    → Gemini finishReason: ${lastFinishReason}`);
    }

    const raw = cand?.content?.parts?.map((p) => p.text).join("") ?? "";
    titles = parseTitlesFromResponse(raw);
    if (titles.length === 5) break;
  }

  if (titles.length !== 5) {
    throw new Error(
      `「${keyword}」제목을 5개 만들지 못했습니다 (현재 ${titles.length}개). 나중에 다시 실행하거나 프롬프트·모델을 확인하세요.`
    );
  }

  return titles;
}

/**
 * config/keywords.json의 모든 키워드에 대해, 최근 이슈를 반영한 제목 후보를 생성한다.
 * @param {AppConfig} config
 * @returns {Promise<{ keyword: string; titles: string[] }[]>}
 */
export async function generateAllTitles(config) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("config/keywords.json에 키워드가 없습니다.");
  }
  if (!config.geminiApiKey) {
    throw new Error(
      "Gemini API 키가 필요합니다. `GEMINI_API_KEY` 환경 변수를 설정하세요."
    );
  }

  const list = keywords
    .map((k) => String(k).trim())
    .filter(Boolean);

  const results = [];
  const gap = Math.max(0, Number(config.delayBetweenKeywordsMs) || 0);

  for (let i = 0; i < list.length; i++) {
    const trimmed = list[i];
    console.log(`  · 제목 생성: "${trimmed}"`);
    const titles = await generateTitle(trimmed, config);
    results.push({ keyword: trimmed, titles });

    if (gap > 0 && i < list.length - 1) {
      await sleep(gap);
    }
  }

  if (results.length === 0) {
    throw new Error("유효한 키워드가 없습니다.");
  }

  return results;
}

export { generateTitle };
