import axios from "axios";
import { sleep } from "../../lib/sleep.js";

/**
 * OpenAI Chat Completions (ChatGPT 계열) → 통일된 결과 형태로 반환
 * @param {object} config
 * @param {string} config.openaiApiKey
 * @param {string} [config.openaiModel]
 * @param {number} [config.openaiRetryMax]
 * @param {number} [config.openaiRetryBaseMs]
 * @returns {import("./types.js").LlmClient}
 */
export function createOpenAiClient(config) {
  const extraRetries = Math.max(0, Number(config.openaiRetryMax ?? config.geminiRetryMax) || 0);
  const baseMs = Math.max(500, Number(config.openaiRetryBaseMs ?? config.geminiRetryBaseMs) || 2000);
  const MAX_BACKOFF_MS = 120_000;
  const maxAttempts = 1 + extraRetries;

  const url = "https://api.openai.com/v1/chat/completions";

  return {
    async generate(prompt, generationConfig) {
      const maxTokens = generationConfig?.maxOutputTokens ?? 4096;
      const temperature = generationConfig?.temperature ?? 0.55;
      const wantJson =
        generationConfig?.responseMimeType === "application/json";

      const body = {
        model: config.openaiModel ?? "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature,
      };
      if (wantJson) {
        body.response_format = { type: "json_object" };
      }

      let lastErr;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const { data } = await axios.post(url, body, {
            headers: {
              Authorization: `Bearer ${config.openaiApiKey}`,
              "Content-Type": "application/json",
            },
          });
          const choice = data?.choices?.[0];
          const text = choice?.message?.content ?? "";
          const finishReason = choice?.finish_reason;
          return { text, finishReason };
        } catch (err) {
          lastErr = err;
          const status = err.response?.status;
          const retryable = status === 429 || status === 503 || status === 502;

          if (!retryable || attempt >= maxAttempts - 1) {
            if (status === 429) {
              const detail =
                err.response?.data?.error?.message || err.message || "";
              throw new Error(
                `OpenAI API 요청 한도(429)에 걸렸습니다. ${detail ? `${detail} ` : ""}잠시 후 다시 실행하세요.`
              );
            }
            throw err;
          }

          let waitMs = baseMs * Math.pow(2, attempt);
          waitMs = Math.min(waitMs, MAX_BACKOFF_MS);
          console.warn(
            `    → OpenAI HTTP ${status}, ${Math.ceil(waitMs / 1000)}초 대기 후 재시도 (${attempt + 1}/${extraRetries})`
          );
          await sleep(waitMs);
        }
      }

      throw lastErr;
    },
  };
}
