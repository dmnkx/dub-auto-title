/** @param {unknown} v */
export function trimmedOrEmpty(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/**
 * 로그용: 연속 공백을 한 칸으로 줄이고 앞뒤 trim
 * @param {unknown} s
 */
export function squishWhitespaceOneLine(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

/**
 * 한 줄 미리보기(ellipsis 포함 여부)
 * @param {unknown} s
 * @param {number} maxLen
 * @returns {{ preview: string, truncated: boolean, length: number }}
 */
export function previewOneLine(s, maxLen) {
  const one = squishWhitespaceOneLine(s);
  const truncated = one.length > maxLen;
  const preview = truncated ? one.slice(0, maxLen) : one;
  return { preview, truncated, length: one.length };
}
