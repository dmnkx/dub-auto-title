/**
 * @typedef {object} LlmGenerationOptions
 * @property {number} [maxOutputTokens]
 * @property {number} [temperature]
 * @property {string} [responseMimeType] 예: "application/json"
 */

/**
 * @typedef {object} LlmGenerateResult
 * @property {string} text 모델이 생성한 전체 텍스트
 * @property {string} [finishReason] 제공자별 종료 사유(있을 때만)
 */

/**
 * LLM 제공자 공통 인터페이스(구현체는 gemini / openai 등).
 * @typedef {object} LlmClient
 * @property {(prompt: string, options: LlmGenerationOptions) => Promise<LlmGenerateResult>} generate
 */

export {};
