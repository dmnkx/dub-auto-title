import fs from "fs";
import { google } from "googleapis";

/**
 * @typedef {object} SheetsConfig
 * @property {string} spreadsheetId
 * @property {string} sheetRange
 * @property {string} serviceAccountJsonPath
 * @property {string | null} [serviceAccountJsonRaw]
 */

/**
 * @param {SheetsConfig} config
 */
function loadServiceAccount(config) {
  if (config.serviceAccountJsonRaw) {
    return JSON.parse(config.serviceAccountJsonRaw);
  }
  const p = config.serviceAccountJsonPath;
  if (!fs.existsSync(p)) {
    throw new Error(
      `서비스 계정 JSON을 찾을 수 없습니다: ${p}\nSERVICE_ACCOUNT_JSON_PATH 환경 변수를 설정하거나, GOOGLE_SERVICE_ACCOUNT 환경 변수(= JSON 문자열)를 사용하세요.`
    );
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * @param {{ keyword: string; titles: string[] }[]} batch
 * @param {string} runDate YYYY-MM-DD
 * @returns {string[][]} [[runDate, keyword, title], ...]
 */
function buildSheetValues(batch, runDate) {
  const values = [];
  for (const { keyword, titles } of batch) {
    for (const title of titles) {
      values.push(["", runDate, keyword, title]);
    }
  }
  return values;
}

/**
 * @param {{ keyword: string; titles: string[] }[]} batch
 * @param {SheetsConfig} config
 */
export async function uploadAllTitles(batch, config) {
  if (!config.spreadsheetId) {
    throw new Error(
      "스프레드시트 ID가 필요합니다. `SPREADSHEET_ID`(또는 `GOOGLE_SHEET_ID`) 환경 변수를 설정하세요."
    );
  }

  const credentials = loadServiceAccount(config);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const runDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const values = buildSheetValues(batch, runDate);

  if (values.length === 0) {
    console.log("  (업로드할 행 없음)");
    return;
  }

  console.log(`  · 업로드 range: ${config.sheetRange}`);
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: config.sheetRange,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  console.log(`  · 시트에 ${values.length}행 추가됨`);
}
