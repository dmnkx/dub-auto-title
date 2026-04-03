import { MIN_TITLE_LENGTH } from "../prompts.js";
import { isLogVerbose } from "./env.js";
import { previewOneLine } from "./string.js";

function isPlausibleTitle(s) {
  const t = s.trim();
  if (t.length < MIN_TITLE_LENGTH) return false;
  // 끊긴 한 줄: 매우 짧고 쉼표/초점으로만 끝남
  if (t.length < MIN_TITLE_LENGTH + 4 && /^(.{2,25})[，,、…]\s*$/.test(t)) {
    return false;
  }
  return true;
}

function parseTitlesFromText(text) {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line.replace(/^\s*[-*•]?\s*\d+[\.\)]\s*/, "").trim()
    )
    .filter(Boolean);
}

function extractJsonArrayString(text) {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const bracket = s.match(/\[[\s\S]*\]/);
  return bracket ? bracket[0] : null;
}

/**
 * 모델 응답에서 제목 5개 추출. JSON 배열 우선, 실패 시 줄 단위(검증 후).
 * @param {string} text
 * @returns {string[]}
 */
export function parseTitlesFromResponse(text) {
  const verbose = isLogVerbose();
  const raw = text.trim();
  const jsonSlice = extractJsonArrayString(raw);

  if (jsonSlice) {
    try {
      const arr = JSON.parse(jsonSlice);
      if (Array.isArray(arr)) {
        const out = arr
          .map((x) => String(x).replace(/\r?\n/g, " ").trim())
          .filter(isPlausibleTitle);
        if (out.length >= 5) return out.slice(0, 5);
      }
    } catch (e) {
      if (verbose) {
        const pl = previewOneLine(jsonSlice, 180);
        console.warn(
          `    → [TitleParser] JSON parse 실패: ${e?.message ?? String(e)} preview="${pl.preview}${pl.truncated ? "…" : ""}"`
        );
      }
      /* fallthrough */
    }
  }

  return parseTitlesFromText(raw).filter(isPlausibleTitle).slice(0, 5);
}
