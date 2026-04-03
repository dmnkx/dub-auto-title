import {
  buildPromptFromIssues,
  buildRegenerateHint,
} from "../prompts.js";
import { isLogVerbose } from "./env.js";
import { sleep } from "./sleep.js";
import { previewOneLine } from "./string.js";
import { parseTitlesFromResponse } from "./title_parser.js";

/**
 * 단일 `LlmClient`에 대해 프롬프트/토큰 조정 후보로 제목 5개를 얻을 때까지 시도한다.
 * API 재시도(429 등)는 어댑터(gemini/openai) 쪽에서 처리하고, 여기서는 “응답 품질” 기준 재생성만 다룬다.
 *
 * 차후 `geminiModel`·API 키를 배열로 두고 실패 시 다음 조합으로 넘기려면,
 * 이 함수를 감싸는 얇은 오케스트레이터(또는 팩토리에서 폴백 클라이언트 생성)만 추가하면 된다.
 *
 * @param {import("../adapters/llm/types.js").LlmClient} llm
 * @param {object} ctx
 * @param {string} ctx.keyword
 * @param {string[]} ctx.headlines
 * @param {number} [ctx.maxOutputTokensBase] 기본 상한(클램프는 호출부 config와 동일 규칙 권장)
 * @returns {Promise<string[]>} 정확히 5개의 제목
 */
export async function runLlmUntilFiveTitles(llm, ctx) {
  const verbose = isLogVerbose();

  const { keyword, headlines } = ctx;
  const baseOutTok = Math.min(
    8192,
    Math.max(1024, Number(ctx.maxOutputTokensBase) || 8192)
  );

  let basePrompt = buildPromptFromIssues(keyword, headlines);
  let titles = [];
  /** @type {string | undefined} */
  let lastFinishReason;
  const apiDelayMs = 12_000;

  for (let attempt = 0; attempt < 3; attempt++) {
    const temperature = attempt === 0 ? 0.55 : 0.45;
    if (attempt === 1) {
      console.warn("    → 제목이 5개 미만이거나 너무 짧아 1회 재생성");
      basePrompt =
        buildPromptFromIssues(keyword, headlines) + buildRegenerateHint();
    } else if (attempt === 2) {
      console.warn("    → 출력이 잘렸을 수 있어 maxOutputTokens 상한으로 1회 재시도");
      basePrompt =
        buildPromptFromIssues(keyword, headlines) +
        `\n\n**재시도**: 출력이 중간에 끊기지 않게 JSON 배열만 간결히 완성하라.`;
    }

    const bumpTokens = attempt === 2 || lastFinishReason === "MAX_TOKENS";
    const maxOutputTokens = bumpTokens ? 8192 : baseOutTok;

    if (verbose) {
      const pl = previewOneLine(basePrompt, 220);
      console.log(
        `    → LLM attempt ${attempt + 1}/3 (temperature=${temperature}, maxOutputTokens=${maxOutputTokens})`
      );
      console.log(
        `    → prompt length=${String(basePrompt).length}, preview="${pl.preview}${pl.truncated ? "…" : ""}"`
      );
    } else {
      console.log(
        `    → LLM attempt ${attempt + 1}/3 (maxOutputTokens=${maxOutputTokens})`
      );
    }

    const { text: raw, finishReason } = await llm.generate(basePrompt, {
      maxOutputTokens,
      temperature,
      responseMimeType: "application/json",
    });

    lastFinishReason = finishReason;
    const fr = lastFinishReason ? String(lastFinishReason) : "";
    if (fr && fr.toUpperCase() !== "STOP") {
      console.warn(`    → LLM finishReason: ${lastFinishReason}`);
    }

    if (verbose) {
      const rl = previewOneLine(raw ?? "", 220);
      console.log(
        `    → raw length=${String(raw ?? "").length}, raw preview="${rl.preview}${rl.truncated ? "…" : ""}"`
      );
    }

    titles = parseTitlesFromResponse(raw ?? "");
    if (verbose) {
      console.log(`    → parsed titles=${titles.length}: ${JSON.stringify(titles)}`);
    }
    const shouldTryAgain = titles.length !== 5 && attempt < 2;
    if (shouldTryAgain) {
      console.log(
        `    → 품질 기준 미달, ${Math.round(apiDelayMs / 1000)}초 대기 후 재시도`
      );
      await sleep(apiDelayMs);
    }
    if (titles.length === 5) break;
  }

  if (titles.length !== 5) {
    throw new Error(
      `「${keyword}」제목을 5개 만들지 못했습니다 (현재 ${titles.length}개). lastFinishReason=${lastFinishReason ?? "unknown"}. 프롬프트·모델을 확인하세요.`
    );
  }

  return titles;
}
