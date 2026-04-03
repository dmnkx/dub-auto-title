import { sleep } from "./sleep.js";

export const DEFAULT_RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503]);

/**
 * @param {unknown} err
 * @returns {number|undefined}
 */
export function axiosResponseStatus(err) {
  return /** @type {{ response?: { status?: number } }} */ (err).response?.status;
}

/**
 * @param {unknown} err
 */
export function axiosErrorDetailForLog(err) {
  const e = /** @type {{ response?: { data?: { error?: { message?: string }|string } }, message?: string }} */ (
    err
  );
  const d =
    (typeof e.response?.data?.error === "object" &&
      e.response?.data?.error?.message) ||
    (typeof e.response?.data?.error === "string" && e.response.data.error) ||
    e.message ||
    "";
  return String(d ?? "");
}

/**
 * HTTP 429/502/503 등에 대한 공통 백오프 재시도.
 * @template T
 * @param {(ctx: { attempt: number }) => Promise<T>} fn
 * @param {{
 *   maxAttempts: number
 *   baseMs: number
 *   maxBackoffMs?: number
 *   getStatus?: (err: unknown) => number|undefined
 *   isRetryable?: (status: number|undefined) => boolean
 *   computeWaitMs: (err: unknown, ctx: { attempt: number, baseMs: number }) => number
 *   onRetry?: (info: {
 *     attempt: number
 *     maxAttempts: number
 *     status?: number
 *     waitMs: number
 *     detail: string
 *   }) => void
 *   mapFinalError?: (err: unknown) => unknown
 * }} opts
 * @returns {Promise<T>}
 */
export async function withHttpRetries(fn, opts) {
  const {
    maxAttempts,
    baseMs,
    maxBackoffMs = 120_000,
    getStatus = axiosResponseStatus,
    isRetryable = (s) =>
      s !== undefined && DEFAULT_RETRYABLE_HTTP_STATUSES.has(s),
    computeWaitMs,
    onRetry,
    mapFinalError,
  } = opts;

  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn({ attempt });
    } catch (err) {
      lastErr = err;
      const status = getStatus(err);
      if (!isRetryable(status) || attempt >= maxAttempts - 1) {
        const mapped = mapFinalError?.(err);
        throw mapped !== undefined && mapped !== null ? mapped : err;
      }
      const rawWait = computeWaitMs(err, { attempt, baseMs });
      const waitMs = Math.min(Math.max(rawWait, 0), maxBackoffMs);
      onRetry?.({
        attempt,
        maxAttempts,
        status,
        waitMs,
        detail: axiosErrorDetailForLog(err),
      });
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

/**
 * @param {unknown} _err
 * @param {{ attempt: number, baseMs: number }} ctx
 */
export function exponentialBackoffWait(_err, { attempt, baseMs }) {
  return baseMs * Math.pow(2, attempt);
}

/**
 * Retry-After 헤더(초) 우선, 없으면 지수 백오프
 * @param {unknown} err
 * @param {{ attempt: number, baseMs: number }} ctx
 */
export function geminiLikeBackoffWait(err, { attempt, baseMs }) {
  const raw = /** @type {{ response?: { headers?: Record<string, string> } }} */ (
    err
  ).response?.headers?.["retry-after"];
  if (raw) {
    const sec = parseInt(raw, 10);
    if (!Number.isNaN(sec)) {
      return Math.max(sec * 1000, baseMs);
    }
  }
  return baseMs * Math.pow(2, attempt);
}
