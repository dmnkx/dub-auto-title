import { formatKstTimestamp } from "../lib/time.js";
import { createSheetStorage } from "../adapters/storage/factory.js";

/**
 * @typedef {object} SheetsConfig
 * @property {string} spreadsheetId
 * @property {string} sheetRange
 * @property {string} serviceAccountJsonPath
 * @property {string | null} [serviceAccountJsonRaw]
 * @property {string} [storageProvider]
 */

/**
 * @param {{ keyword: string; titles: string[] }[]} batch
 * @param {string} runAt
 * @returns {string[][]}
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

  const storage = createSheetStorage(config);
  const runAt = formatKstTimestamp();
  const values = buildSheetValues(batch, runAt);

  if (values.length === 0) {
    console.log("  (업로드할 행 없음)");
    return;
  }

  console.log(`  · 업로드 range: ${config.sheetRange}`);
  console.log(`  · 업로드 첫 행 예시: ${JSON.stringify(values[0])}`);
  await storage.appendRows(config.sheetRange, values);

  console.log(`  · 시트에 ${values.length}행 추가됨`);
}
