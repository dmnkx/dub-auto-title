import { createSheetStorage } from "../adapters/storage/factory.js";
import { isLogVerbose } from "../lib/env.js";
import { buildTitleSheetRows } from "../lib/sheet_upload_payload.js";
import { formatKstTimestamp } from "../lib/time.js";

/**
 * @typedef {object} SheetsConfig
 * @property {string} spreadsheetId
 * @property {string} sheetRange
 * @property {string} serviceAccountJsonPath
 * @property {string | null} [serviceAccountJsonRaw]
 * @property {string} [storageProvider]
 */

/**
 * 시트에 제목 데이터를 append
 * @param {{ keyword: string; titles: string[] }[]} batch
 * @param {SheetsConfig} config
 */
export async function uploadAllTitles(batch, config) {
  const verbose = isLogVerbose();

  if (!config.spreadsheetId) {
    throw new Error(
      "스프레드시트 ID가 필요합니다. `SPREADSHEET_ID`(또는 `GOOGLE_SHEET_ID`) 환경 변수를 설정하세요."
    );
  }

  const storage = createSheetStorage(config);
  const runAt = formatKstTimestamp();
  const values = buildTitleSheetRows(batch, runAt);

  if (values.length === 0) {
    console.log("  (업로드할 행 없음)");
    return;
  }

  console.log(`  · 업로드 range: ${config.sheetRange}`);
  if (verbose) {
    console.log(`  · 업로드 runAt(KST): ${runAt}`);
    console.log(
      `  · 업로드 행 수: ${values.length} (첫 행 예시: ${JSON.stringify(values[0])}, 마지막 행 예시: ${JSON.stringify(values[values.length - 1])})`
    );
  } else {
    console.log(`  · 업로드 첫 행 예시: ${JSON.stringify(values[0])}`);
  }
  try {
    await storage.appendRows(config.sheetRange, values);
  } catch (err) {
    console.error(`  · 시트 업로드 실패: ${err?.message ?? String(err)}`);
    throw err;
  }

  console.log(`  · 시트에 ${values.length}행 추가됨`);
}
