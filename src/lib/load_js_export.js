import fs from "fs";
import { pathToFileURL } from "url";

/**
 * ESM 모듈에서 이름 있는 export를 안전하게 로드(파일 없음/실패 시 빈 객체)
 * @param {string} filePath
 * @param {string} exportName
 */
export async function loadNamedExportFromJsFile(filePath, exportName) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const mod = await import(pathToFileURL(filePath).href);
    return mod?.[exportName] ?? {};
  } catch {
    return {};
  }
}
