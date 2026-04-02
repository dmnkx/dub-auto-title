import axios from "axios";
import { readFileSync } from "fs";
import path from "path";
import { projectRoot } from "./config.js";

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

/** 제목 한 줄로 인정할 최소 글자 수(공백 제외가 아닌 전체 길이) */
const MIN_TITLE_LENGTH = 18;

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

/** 프롬프트에 넣는 뉴스 제목 최대 글자 (입력·토큰 절약) */
const PROMPT_HEADLINE_MAX_CHARS = 100;

function clipHeadlineForPrompt(s) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= PROMPT_HEADLINE_MAX_CHARS) return t;
  return `${t.slice(0, PROMPT_HEADLINE_MAX_CHARS - 1)}…`;
}

const OUTPUT_FORMAT_BLOCK = `

**출력 형식 (반드시 지킬 것)**
- 설명·서론·코드펜스(\`\`\`) 없이 **순수 JSON 배열 한 덩어리만** 출력한다.
- 예: ["완결된 제목 문자열 하나","둘","셋","넷","다섯"]
- 배열 길이는 정확히 5. 각 원소는 **완결된 제목 한 줄 전체**, **${MIN_TITLE_LENGTH}자 이상 ~ 80자 내외**로 간결히. 제목 **내부**에 큰따옴표·줄바꿈을 넣지 마라.`;

function buildPromptFromIssues(keyword, headlines) {
  if (headlines.length > 0) {
    const list = headlines
      .map((h, i) => `${i + 1}. ${clipHeadlineForPrompt(h)}`)
      .join("\n");

    return `당신은 **업무 생산성·AI 활용**을 다루는 블로그 편집자다. 이 블로그의 목적은 독자에게 **「AI를 어떻게 활용하면 업무에 도움이 될까」**를 실질적으로 알려 주는 것이다.

아래 목록은 Google 뉴스에서 키워드 「${keyword}」로 검색해 얻은 **최근 보도 기사 제목**이다. 이 가운데 **업무에 쓰는 AI·도구·자동화·생산성**과 맞닿는 흐름을 골라 단서로 삼아라. 뉴스에 규제·보안·정책 논쟁이 섞여 있어도, 제목은 그 결이 아니라 **실무에서 AI를 어떻게 써서 일을 덜고 빠르게 할지** 쪽으로만 써라.

[최근 보도·이슈 (뉴스 제목)]
${list}

**요구사항**
- 위 맥락을 바탕으로, **업무 현장에서 AI를 활용하는 방법·팁·사례·도구 선택**처럼 실용적인 각도의 **블로그 글 제목 후보를 정확히 5개**만 써라.
- AI 규제·법·보안만 단독 주제로 파는 제목, 정치·정책 논쟁 위주 제목은 쓰지 마라.
- 키워드 「${keyword}」와 직접 연결되게 할 것. 막연한 일반론 제목은 피한다.${OUTPUT_FORMAT_BLOCK}`;
  }

  return `당신은 **업무 생산성·AI 활용**을 다루는 블로그 편집자다. 이 블로그의 목적은 독자에게 **「AI를 어떻게 활용하면 업무에 도움이 될까」**를 실질적으로 알려 주는 것이다.

Google 뉴스에서 키워드 「${keyword}」 관련 최근 보도를 가져오지 못했다. 그래도 **2020년대 중반 기준**, 직장인·팀이 실제로 겪는 일(반복 업무, 문서·회의·협업, 도구 도입, 에이전트·자동화로 시간 줄이기 등)에서 이 키워드가 **업무에 어떻게 쓰이면 좋은지**를 가정해 **블로그 글 제목 후보를 정확히 5개**만 써라.

**요구사항**
- **실무 활용·생산성·워크플로** 관점에서 “요즘 이렇게 써 보면 좋다”처럼 시의성 있게 들리게 할 것.
- AI 규제·법·보안만 단독 주제로 파는 제목, 정책·논쟁 위주 제목은 쓰지 마라.${OUTPUT_FORMAT_BLOCK}`;
}

function buildRegenerateHint() {
  return `

**재시도 지시**: 직전 출력에 짧게 끊긴 줄·미완성 문장이 있었다. 이번에는 **JSON 배열만** 출력하고, 다섯 제목 모두 **${MIN_TITLE_LENGTH}자 이상 완결된 문장**으로 다시 써라.`;
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
      "Gemini API 키가 필요합니다. config/user.config.js 또는 GEMINI_API_KEY를 설정하세요."
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
