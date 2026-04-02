import axios from "axios";
import { sleep } from "./lib/sleep.js";

/**
 * Gemini generateContent API 호출 (재시도/백오프 포함).
 * - 429/502/503일 때만 재시도한다.
 *
 * @param {string} prompt
 * @param {object} config
 * @param {object} generationConfig
 * @returns {Promise<any>} Gemini 응답 JSON
 */
export async function geminiGenerateContent(prompt, config, generationConfig) {
  const extraRetries = Math.max(0, Number(config.geminiRetryMax) || 0);
  const maxAttempts = 1 + extraRetries;
  const baseMs = Math.max(500, Number(config.geminiRetryBaseMs) || 2000);

  const MAX_BACKOFF_MS = 120_000;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${encodeURIComponent(
    config.geminiApiKey
  )}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  };

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
            `Gemini API 요청 한도(429)에 걸렸습니다. ${
              detail ? `${detail} ` : ""
            }잠시 후 다시 실행하거나 config의 delayBetweenKeywordsMs·geminiRetryBaseMs를 늘리세요.`
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

