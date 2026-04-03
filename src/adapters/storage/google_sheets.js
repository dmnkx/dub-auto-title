import fs from "fs";
import { google } from "googleapis";

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

function createSheetsClient(config) {
  const credentials = loadServiceAccount(config);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * @param {object} config spreadsheetId, serviceAccountJsonPath, serviceAccountJsonRaw
 * @returns {{ appendRows: (range: string, values: any[][]) => Promise<void> }}
 */
export function createGoogleSheetsStorage(config) {
  return {
    async appendRows(range, values) {
      const sheets = createSheetsClient(config);
      await sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
    },
  };
}
