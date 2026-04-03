import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readEnvNumber } from "./lib/env.js";
import { loadNamedExportFromJsFile } from "./lib/load_js_export.js";
import { trimmedOrEmpty } from "./lib/string.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 프로젝트 루트 (package.json이 있는 디렉터리) */
export const projectRoot = path.join(__dirname, "..");

const userConfigPath = path.join(projectRoot, "config", "user.config.js");
const secretConfigPath = path.join(projectRoot, "config", "secret.config.js");

/** 공개 기본 설정(저장소에 포함되는 `user.config.js`) */
const userConfig = await loadNamedExportFromJsFile(userConfigPath, "userConfig");

/** 로컬 시크릿(`secret.config.js` 없으면 빈 객체 → 환경 변수만 사용) */
const secretConfig = await loadNamedExportFromJsFile(
  secretConfigPath,
  "secretConfig"
);

function rawServiceAccountFromSecretOrEnv() {
  const fromSecret = trimmedOrEmpty(secretConfig.googleServiceAccount);
  const fromEnv = trimmedOrEmpty(process.env.GOOGLE_SERVICE_ACCOUNT);
  const raw = fromSecret || fromEnv;
  return raw || null;
}

/**
 * 환경 변수(배포 시 덮어쓰기) + 공개 `user.config.js` + 시크릿 파일 또는 env
 */
export function resolveConfig() {
  const llmProvider = String(
    process.env.LLM_PROVIDER ?? userConfig.llmProvider ?? "gemini"
  ).toLowerCase();

  const geminiApiKey =
    trimmedOrEmpty(secretConfig.geminiApiKey) ||
    trimmedOrEmpty(process.env.GEMINI_API_KEY);
  const openaiApiKey =
    trimmedOrEmpty(secretConfig.openaiApiKey) ||
    trimmedOrEmpty(process.env.OPENAI_API_KEY);

  if (llmProvider === "gemini" && !geminiApiKey) {
    throw new Error(
      "Gemini 사용 시 `GEMINI_API_KEY` 환경 변수 또는 `config/secret.config.js`의 geminiApiKey가 필요합니다. (`secret.config.example.js` 참고)"
    );
  }
  if (llmProvider === "openai" && !openaiApiKey) {
    throw new Error(
      "OpenAI 사용 시 `OPENAI_API_KEY` 환경 변수 또는 `config/secret.config.js`의 openaiApiKey가 필요합니다."
    );
  }

  const spreadsheetId =
    process.env.SPREADSHEET_ID ??
    process.env.GOOGLE_SHEET_ID ??
    userConfig.spreadsheetId ??
    "";
  if (!spreadsheetId) {
    throw new Error(
      "스프레드시트 ID가 필요합니다. `SPREADSHEET_ID`(또는 `GOOGLE_SHEET_ID`) 환경변수 또는 `config/user.config.js`의 spreadsheetId를 설정하세요."
    );
  }

  const resolvePathFromRoot = (p) =>
    p.startsWith("/") ? p : path.join(projectRoot, p);

  const serviceAccountJsonPath = (() => {
    const fromSecret = trimmedOrEmpty(secretConfig.serviceAccountJsonPath);
    const fromEnv = trimmedOrEmpty(process.env.SERVICE_ACCOUNT_JSON_PATH);
    const p = fromSecret || fromEnv;
    if (!p) return path.join(projectRoot, "config", "service-account.json");
    return resolvePathFromRoot(p);
  })();

  const notifyProvider = String(
    process.env.NOTIFY_PROVIDER ?? userConfig.notifyProvider ?? "discord"
  ).toLowerCase();

  const discordWebhookUrl =
    trimmedOrEmpty(secretConfig.discordWebhookUrl) ||
    trimmedOrEmpty(process.env.DISCORD_WEBHOOK_URL);
  const slackWebhookUrl =
    trimmedOrEmpty(secretConfig.slackWebhookUrl) ||
    trimmedOrEmpty(process.env.SLACK_WEBHOOK_URL);

  const newsSourceProvider = String(
    process.env.NEWS_SOURCE_PROVIDER ??
      userConfig.newsSourceProvider ??
      "google_rss"
  ).toLowerCase();

  const storageProvider = String(
    process.env.STORAGE_PROVIDER ?? userConfig.storageProvider ?? "google_sheets"
  ).toLowerCase();

  return {
    llmProvider,
    geminiApiKey,
    openaiApiKey,
    openaiModel:
      process.env.OPENAI_MODEL ?? userConfig.openaiModel ?? "gpt-4o-mini",
    openaiRetryMax: readEnvNumber(
      "OPENAI_RETRY_MAX",
      userConfig.openaiRetryMax ?? 6
    ),
    openaiRetryBaseMs: readEnvNumber(
      "OPENAI_RETRY_BASE_MS",
      userConfig.openaiRetryBaseMs ?? 2000
    ),
    geminiModel:
      process.env.GEMINI_MODEL ?? userConfig.geminiModel ?? "gemini-2.5-flash",
    geminiRetryMax: readEnvNumber(
      "GEMINI_RETRY_MAX",
      userConfig.geminiRetryMax ?? 6
    ),
    geminiRetryBaseMs: readEnvNumber(
      "GEMINI_RETRY_BASE_MS",
      userConfig.geminiRetryBaseMs ?? 2000
    ),
    delayBetweenKeywordsMs: readEnvNumber(
      "DELAY_BETWEEN_KEYWORDS_MS",
      userConfig.delayBetweenKeywordsMs ?? 12_000
    ),
    geminiMaxOutputTokens: Math.min(
      8192,
      Math.max(
        1024,
        readEnvNumber(
          "GEMINI_MAX_OUTPUT_TOKENS",
          userConfig.geminiMaxOutputTokens ?? 8192
        )
      )
    ),
    newsHeadlineLimit:
      Number(process.env.NEWS_HEADLINE_LIMIT) ||
      userConfig.newsHeadlineLimit ||
      12,
    spreadsheetId,
    sheetRange:
      process.env.SHEET_RANGE ?? userConfig.sheetRange ?? "시트1!A:C",
    serviceAccountJsonPath,
    /** CI 또는 `secret.config.js`의 googleServiceAccount */
    serviceAccountJsonRaw: rawServiceAccountFromSecretOrEnv(),
    notifyProvider,
    discordWebhookUrl,
    slackWebhookUrl,
    newsSourceProvider,
    storageProvider,
  };
}
