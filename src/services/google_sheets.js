import fs from "fs";
import { google } from "googleapis";

/**
 * 서비스 계정 로딩
 * @param {{ serviceAccountJsonPath: string; serviceAccountJsonRaw: string | null }} config
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
 * Google Sheets client 생성
 * @param {{ serviceAccountJsonPath: string; serviceAccountJsonRaw: string | null }} config
 */
function createSheetsClient(config) {
  const credentials = loadServiceAccount(config);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * 시트에 값 append
 * @param {{ spreadsheetId: string; serviceAccountJsonPath: string; serviceAccountJsonRaw: string | null }} config
 * @param {string} range A1 range
 * @param {any[][]} values
 */
export async function appendSheetValues(config, range, values) {
  const sheets = createSheetsClient(config);
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

