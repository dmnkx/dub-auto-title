/**
 * 시트 업로드용 2차원 값 (타임스탬프, 키워드, 제목)
 * @param {{ keyword: string; titles: string[] }[]} batch
 * @param {string} runAt
 * @returns {string[][]}
 */
export function buildTitleSheetRows(batch, runAt) {
  const values = [];
  for (const { keyword, titles } of batch) {
    for (const title of titles) {
      values.push([runAt, keyword, title]);
    }
  }
  return values;
}
