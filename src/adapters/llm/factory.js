import { createGeminiClient } from "./gemini.js";
import { createOpenAiClient } from "./openai.js";

/**
 * @param {object} config
 * @param {string} [config.llmProvider] "gemini" | "openai"
 * @returns {import("./types.js").LlmClient}
 */
export function createLlmClient(config) {
  const provider = String(config.llmProvider ?? "gemini").toLowerCase();

  if (provider === "openai") {
    return createOpenAiClient(config);
  }
  if (provider === "gemini") {
    return createGeminiClient(config);
  }

  throw new Error(
    `지원하지 않는 LLM_PROVIDER 입니다: ${provider}. (gemini | openai)`
  );
}
