import { createLlmClient } from "../adapters/llm/factory.js";
import { createNewsSource } from "../adapters/news/factory.js";
import { isLogVerbose } from "../lib/env.js";
import { sleep } from "../lib/sleep.js";
import { runLlmUntilFiveTitles } from "../lib/llm_title_run.js";
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

  return runLlmUntilFiveTitles(llm, {
    keyword,
    headlines,
    maxOutputTokensBase: config.geminiMaxOutputTokens,
  });
}

function resolveLlmModelLabel(config) {
  return config.llmProvider === "openai"
    ? config.openaiModel
    : config.geminiModel;
}

/**
 * config/keywords.json의 모든 키워드에 대해, 최근 이슈를 반영한 제목 후보를 생성한다.
 * @param {AppConfig} config
 * @returns {Promise<{ keyword: string; titles: string[] }[]>}
 */
export async function generateAllTitles(config) {
  const llm = createLlmClient(config);
  const news = createNewsSource(config);
  const verbose = isLogVerbose();

  const keywords = loadKeywords();
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("config/keywords.json에 키워드가 없습니다.");
  }

  const list = keywords.map((k) => String(k).trim()).filter(Boolean);

  const gap = Math.max(0, Number(config.delayBetweenKeywordsMs) || 0);

  if (verbose) {
    console.log(`  · 키워드 개수: ${list.length}`);
    console.log(
      `  · LLM 설정: ${config.llmProvider} / model=${resolveLlmModelLabel(config)}`
    );
    console.log(`  · 키워드 간 간격: ${gap}ms (마지막 키워드 다음에는 대기 없음)`);
  }

  const results = [];

  for (let i = 0; i < list.length; i++) {
    const trimmed = list[i];
    const keywordStartedAt = Date.now();
    console.log(`  · 제목 생성: "${trimmed}"`);
    const titles = await generateTitle(trimmed, config, llm, news);
    results.push({ keyword: trimmed, titles });
    if (verbose) {
      console.log(
        `    → 완료: ${titles.length}개, 소요 ${Math.round(
          (Date.now() - keywordStartedAt) / 1000
        )}초`
      );
      console.log(`    → 제목 후보: ${JSON.stringify(titles)}`);
    }

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
