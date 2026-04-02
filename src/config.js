import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 프로젝트 루트 (package.json이 있는 디렉터리) */
export const projectRoot = path.join(__dirname, "..");

const userConfigPath = path.join(projectRoot, "config", "user.config.js");
const userConfigExamplePath = path.join(
  projectRoot,
  "config",
  "user.config.example.js"
);

const resolvedPath = fs.existsSync(userConfigPath)
  ? userConfigPath
  : userConfigExamplePath;

/** 로컬 전용 `user.config.js`가 있으면 사용, 없으면 커밋된 예시 파일 사용 */
export const userConfig = (await import(pathToFileURL(resolvedPath).href))
  .userConfig;

/** 로컬 `userConfig`와 환경 변수(CI용)를 합친 최종 설정 */
export function resolveConfig() {
  const jsonPath = userConfig.serviceAccountJsonPath.startsWith("/")
    ? userConfig.serviceAccountJsonPath
    : path.join(projectRoot, userConfig.serviceAccountJsonPath);

  const envNum = (envKey, fallback) => {
    const v = process.env[envKey];
    if (v !== undefined && v !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  };

  return {
    geminiApiKey: process.env.GEMINI_API_KEY || userConfig.geminiApiKey,
    geminiModel: process.env.GEMINI_MODEL || userConfig.geminiModel,
    geminiRetryMax: envNum("GEMINI_RETRY_MAX", userConfig.geminiRetryMax ?? 6),
    geminiRetryBaseMs: envNum(
      "GEMINI_RETRY_BASE_MS",
      userConfig.geminiRetryBaseMs ?? 2000
    ),
    delayBetweenKeywordsMs: envNum(
      "DELAY_BETWEEN_KEYWORDS_MS",
      userConfig.delayBetweenKeywordsMs ?? 2500
    ),
    geminiMaxOutputTokens: Math.min(
      8192,
      Math.max(
        1024,
        envNum(
          "GEMINI_MAX_OUTPUT_TOKENS",
          userConfig.geminiMaxOutputTokens ?? 8192
        )
      )
    ),
    newsHeadlineLimit:
      Number(process.env.NEWS_HEADLINE_LIMIT) || userConfig.newsHeadlineLimit,
    spreadsheetId:
      process.env.SPREADSHEET_ID ||
      process.env.GOOGLE_SHEET_ID ||
      userConfig.spreadsheetId,
    sheetRange: process.env.SHEET_RANGE || userConfig.sheetRange,
    serviceAccountJsonPath: jsonPath,
    /** CI에서만 주입하는 경우 */
    serviceAccountJsonRaw: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null,
  };
}
