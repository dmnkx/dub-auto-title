import axios from "axios";
import { sleep } from "../../lib/sleep.js";

/**
 * Gemini generateContent → 통일된 결과 형태로 반환
 * @param {object} config
 * @returns {import("./types.js").LlmClient}
 */
export function createGeminiClient(config) {
  return {
    async generate(prompt, generationConfig) {
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
          const cand = data?.candidates?.[0];
          const text =
            cand?.content?.parts?.map((p) => p.text).join("") ?? "";
          return {
            text,
            finishReason: cand?.finishReason,
          };
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
    },
  };
}
