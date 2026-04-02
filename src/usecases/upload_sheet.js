import { formatKstTimestamp } from "../lib/time.js";
import { appendSheetValues } from "../services/google_sheets.js";

/**
 * @typedef {object} SheetsConfig
 * @property {string} spreadsheetId
 * @property {string} sheetRange
 * @property {string} serviceAccountJsonPath
 * @property {string | null} [serviceAccountJsonRaw]
 */

/**
 * @param {{ keyword: string; titles: string[] }[]} batch
 * @param {string} runAt YYYY-MM-DD HH:mm:ss
 * @returns {string[][]} [[runAt, keyword, title], ...]
 */
function buildSheetValues(batch, runAt) {
  const values = [];
  for (const { keyword, titles } of batch) {
    for (const title of titles) {
      values.push([runAt, keyword, title]);
    }
  }
  return values;
}

/**
 * 시트에 제목 데이터를 append
 * @param {{ keyword: string; titles: string[] }[]} batch
 * @param {SheetsConfig} config
 */
export async function uploadAllTitles(batch, config) {
  if (!config.spreadsheetId) {
    throw new Error(
      "스프레드시트 ID가 필요합니다. `SPREADSHEET_ID`(또는 `GOOGLE_SHEET_ID`) 환경 변수를 설정하세요."
    );
  }

  const runAt = formatKstTimestamp(); // YYYY-MM-DD HH:mm:ss
  const values = buildSheetValues(batch, runAt);

  if (values.length === 0) {
    console.log("  (업로드할 행 없음)");
    return;
  }

  console.log(`  · 업로드 range: ${config.sheetRange}`);
  console.log(`  · 업로드 첫 행 예시: ${JSON.stringify(values[0])}`);
  await appendSheetValues(config, config.sheetRange, values);

  console.log(`  · 시트에 ${values.length}행 추가됨`);
}
