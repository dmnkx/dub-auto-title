import axios from "axios";
import { isLogVerbose } from "../../lib/env.js";
import {
  axiosErrorDetailForLog,
  axiosResponseStatus,
  exponentialBackoffWait,
  withHttpRetries,
} from "../../lib/http_retry.js";

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
  const extraRetries = Math.max(
    0,
    Number(config.openaiRetryMax ?? config.geminiRetryMax) || 0
  );
  const baseMs = Math.max(
    500,
    Number(config.openaiRetryBaseMs ?? config.geminiRetryBaseMs) || 2000
  );
  const maxAttempts = 1 + extraRetries;

  const url = "https://api.openai.com/v1/chat/completions";

  return {
    async generate(prompt, generationConfig) {
      const verbose = isLogVerbose();
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

      return withHttpRetries(
        async ({ attempt }) => {
          if (verbose) {
            console.log(
              `    → [OpenAI HTTP] attempt ${attempt + 1}/${maxAttempts} model=${body.model} maxTokens=${maxTokens} temperature=${temperature} wantJson=${wantJson}`
            );
          }
          const { data } = await axios.post(url, body, {
            headers: {
              Authorization: `Bearer ${config.openaiApiKey}`,
              "Content-Type": "application/json",
            },
          });
          const choice = data?.choices?.[0];
          const text = choice?.message?.content ?? "";
          const finishReason = choice?.finish_reason;
          if (verbose) {
            console.log(
              `    → [OpenAI HTTP] success textLength=${text.length} finishReason=${finishReason ?? "none"}`
            );
          }
          return { text, finishReason };
        },
        {
          maxAttempts,
          baseMs,
          computeWaitMs: exponentialBackoffWait,
          onRetry: ({
            status,
            waitMs,
            attempt,
            maxAttempts: maxA,
            detail,
          }) => {
            const d = String(detail ?? "");
            console.warn(
              `    → [OpenAI HTTP] ${status}, ${Math.ceil(waitMs / 1000)}초 대기 후 재시도 (${attempt + 1}/${maxA}), error="${d.slice(0, 200)}${d.length > 200 ? "…" : ""}"`
            );
          },
          mapFinalError: (err) => {
            if (axiosResponseStatus(err) === 429) {
              const detail = axiosErrorDetailForLog(err);
              return new Error(
                `OpenAI API 요청 한도(429)에 걸렸습니다. ${detail ? `${detail} ` : ""}잠시 후 다시 실행하세요.`
              );
            }
          },
        }
      );
    },
  };
}
