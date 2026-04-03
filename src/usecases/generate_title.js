import { createLlmClient } from "../adapters/llm/factory.js";
import { createNewsSource } from "../adapters/news/factory.js";
import {
  buildPromptFromIssues,
  buildRegenerateHint,
} from "../prompts.js";
import { sleep } from "../lib/sleep.js";
import { parseTitlesFromResponse } from "../lib/title_parser.js";
import { loadKeywords } from "../keywords.js";

/**
 * @typedef {object} AppConfig
 * @property {string} llmProvider
 * @property {string} geminiApiKey
 * @property {string} openaiApiKey
 * @property {string} geminiModel
 * @property {string} openaiModel
 * @property {number} geminiRetryMax
 * @property {number} geminiRetryBaseMs
 * @property {number} openaiRetryMax
 * @property {number} openaiRetryBaseMs
 * @property {number} delayBetweenKeywordsMs
 * @property {number} geminiMaxOutputTokens
 * @property {number} newsHeadlineLimit
 */

/**
 * @param {string} keyword
 * @param {AppConfig} config
 * @param {import("../adapters/llm/types.js").LlmClient} llm
 * @param {{ fetchHeadlines: (k: string, c: AppConfig) => Promise<string[]> }} news
 */
async function generateTitle(keyword, config, llm, news) {
  const headlines = await news.fetchHeadlines(keyword, config);
  if (headlines.length > 0) {
    console.log(`    → 최근 뉴스 ${headlines.length}건 반영`);
  } else {
    console.log(`    → 뉴스 없음, 시의성 가정으로 생성`);
  }

  const baseOutTok = Math.min(
    8192,
    Math.max(1024, Number(config.geminiMaxOutputTokens) || 8192)
  );

  let basePrompt = buildPromptFromIssues(keyword, headlines);
  let titles = [];
  /** @type {string | undefined} */
  let lastFinishReason;
  const apiDelayMs = 12_000;

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

    const { text: raw, finishReason } = await llm.generate(basePrompt, {
      maxOutputTokens,
      temperature: attempt === 0 ? 0.55 : 0.45,
      responseMimeType: "application/json",
    });

    lastFinishReason = finishReason;
    const fr = lastFinishReason ? String(lastFinishReason) : "";
    if (fr && fr.toUpperCase() !== "STOP") {
      console.warn(`    → LLM finishReason: ${lastFinishReason}`);
    }

    titles = parseTitlesFromResponse(raw ?? "");
    const shouldTryAgain = titles.length !== 5 && attempt < 2;
    if (shouldTryAgain) await sleep(apiDelayMs);
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
  const llm = createLlmClient(config);
  const news = createNewsSource(config);

  const keywords = loadKeywords();
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("config/keywords.json에 키워드가 없습니다.");
  }

  const list = keywords
    .map((k) => String(k).trim())
    .filter(Boolean);

  const results = [];
  const gap = 12_000;

  for (let i = 0; i < list.length; i++) {
    const trimmed = list[i];
    console.log(`  · 제목 생성: "${trimmed}"`);
    const titles = await generateTitle(trimmed, config, llm, news);
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
