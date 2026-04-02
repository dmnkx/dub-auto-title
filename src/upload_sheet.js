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
 * @param {string} runAt YYYY-MM-DD HH:mm:ss
 * @returns {string[][]} [[runAt, keyword, title], ...]
 */
function buildSheetValues(batch, runAt) {
  const values = [];
  for (const { keyword, titles } of batch) {
    for (const title of titles) {
      // `sheetRange`가 A:C(3열)일 때 값도 정확히 3열로만 매칭합니다.
      values.push([runAt, keyword, title]);
    }
  }
  return values;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Asia/Seoul 기준 타임스탬프
 * @param {Date} [d]
 * @returns {string} YYYY-MM-DD HH:mm:ss
 */
function formatKstTimestamp(d = new Date()) {
  // KST는 DST가 없어서 "UTC+9"로 고정 오프셋 변환만 하면 됩니다.
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  // Sheets에서 날짜/시간으로 파싱되기 쉬운 ISO-8601 형태로 보냅니다.
  return `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(
    kst.getUTCDate()
  )}T${pad2(kst.getUTCHours())}:${pad2(kst.getUTCMinutes())}:${pad2(
    kst.getUTCSeconds()
  )}+09:00`;
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

  const runAt = formatKstTimestamp(); // YYYY-MM-DD HH:mm:ss
  const values = buildSheetValues(batch, runAt);

  if (values.length === 0) {
    console.log("  (업로드할 행 없음)");
    return;
  }

  console.log(`  · 업로드 range: ${config.sheetRange}`);
  console.log(`  · 업로드 첫 행 예시: ${JSON.stringify(values[0])}`);
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: config.sheetRange,
    // USER_ENTERED여야 Sheets가 날짜/시간 문자열을 날짜형으로 파싱합니다.
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  console.log(`  · 시트에 ${values.length}행 추가됨`);
}
