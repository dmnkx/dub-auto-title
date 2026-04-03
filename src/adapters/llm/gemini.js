import axios from "axios";
import { isLogVerbose } from "../../lib/env.js";
import {
  axiosErrorDetailForLog,
  axiosResponseStatus,
  geminiLikeBackoffWait,
  withHttpRetries,
} from "../../lib/http_retry.js";

/**
 * Gemini generateContent → 통일된 결과 형태로 반환
 * @param {object} config
 * @returns {import("./types.js").LlmClient}
 */
export function createGeminiClient(config) {
  return {
    async generate(prompt, generationConfig) {
      const verbose = isLogVerbose();
      const extraRetries = Math.max(0, Number(config.geminiRetryMax) || 0);
      const maxAttempts = 1 + extraRetries;
      const baseMs = Math.max(500, Number(config.geminiRetryBaseMs) || 2000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${encodeURIComponent(
        config.geminiApiKey
      )}`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      };

      return withHttpRetries(
        async ({ attempt }) => {
          if (verbose) {
            console.log(
              `    → [Gemini HTTP] attempt ${attempt + 1}/${maxAttempts} model=${config.geminiModel} maxOutputTokens=${generationConfig?.maxOutputTokens ?? ""}`
            );
          }
          const { data } = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" },
          });
          const cand = data?.candidates?.[0];
          const text =
            cand?.content?.parts?.map((p) => p.text).join("") ?? "";
          if (verbose) {
            console.log(
              `    → [Gemini HTTP] success textLength=${text.length} finishReason=${cand?.finishReason ?? "none"}`
            );
          }
          return { text, finishReason: cand?.finishReason };
        },
        {
          maxAttempts,
          baseMs,
          computeWaitMs: geminiLikeBackoffWait,
          onRetry: ({
            status,
            waitMs,
            attempt,
            maxAttempts: maxA,
            detail,
          }) => {
            const d = String(detail ?? "");
            console.warn(
              `    → [Gemini HTTP] ${status}, ${Math.ceil(waitMs / 1000)}초 대기 후 재시도 (${attempt + 1}/${maxA}), error="${d.slice(0, 200)}${d.length > 200 ? "…" : ""}"`
            );
          },
          mapFinalError: (err) => {
            if (axiosResponseStatus(err) === 429) {
              const detail = axiosErrorDetailForLog(err);
              return new Error(
                `Gemini API 요청 한도(429)에 걸렸습니다. ${
                  detail ? `${detail} ` : ""
                }잠시 후 다시 실행하거나 config의 delayBetweenKeywordsMs·geminiRetryBaseMs를 늘리세요.`
              );
            }
          },
        }
      );
    },
  };
}
