import { createGoogleSheetsStorage } from "./google_sheets.js";

/**
 * 스프레드시트 저장소 (추후 Airtable, DB 등으로 교체 가능)
 * @param {object} config
 * @param {string} [config.storageProvider] 현재는 google_sheets 만
 */
export function createSheetStorage(config) {
  const provider = String(config.storageProvider ?? "google_sheets").toLowerCase();

  if (provider === "google_sheets") {
    return createGoogleSheetsStorage(config);
  }

  throw new Error(
    `지원하지 않는 STORAGE_PROVIDER 입니다: ${provider}. (google_sheets)`
  );
}
