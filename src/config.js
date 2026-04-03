import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 프로젝트 루트 (package.json이 있는 디렉터리) */
export const projectRoot = path.join(__dirname, "..");

const userConfigPath = path.join(projectRoot, "config", "user.config.js");

/** 로컬 설정(있으면 로드, CI에서는 보통 파일이 없어도 동작하도록 빈 객체) */
let userConfig = {};
try {
  if (fs.existsSync(userConfigPath)) {
    const mod = await import(pathToFileURL(userConfigPath).href);
    userConfig = mod?.userConfig ?? {};
  }
} catch {
  userConfig = {};
}

/** 환경 변수(예: API KEY) + user.config.js(나머지 설정) + 기본값 합친 최종 설정 */
export function resolveConfig() {
  const envNum = (envKey, fallback) => {
    const v = process.env[envKey];
    if (v !== undefined && v !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  };

  const llmProvider = String(
    process.env.LLM_PROVIDER ?? userConfig.llmProvider ?? "gemini"
  ).toLowerCase();

  const geminiApiKey =
    process.env.GEMINI_API_KEY ?? userConfig.geminiApiKey ?? "";
  const openaiApiKey =
    process.env.OPENAI_API_KEY ?? userConfig.openaiApiKey ?? "";

  if (llmProvider === "gemini" && !geminiApiKey) {
    throw new Error(
      "Gemini 사용 시 `GEMINI_API_KEY` 환경 변수를 설정하세요. (또는 LLM_PROVIDER=openai)"
    );
  }
  if (llmProvider === "openai" && !openaiApiKey) {
    throw new Error(
      "OpenAI 사용 시 `OPENAI_API_KEY` 환경 변수를 설정하세요. (또는 LLM_PROVIDER=gemini)"
    );
  }

  const spreadsheetId =
    process.env.SPREADSHEET_ID ??
    process.env.GOOGLE_SHEET_ID ??
    userConfig.spreadsheetId ??
    "";
  if (!spreadsheetId) {
    throw new Error(
      "스프레드시트 ID가 필요합니다. `SPREADSHEET_ID`(또는 `GOOGLE_SHEET_ID`) 환경변수를 설정하세요."
    );
  }

  const resolvePathFromRoot = (p) =>
    p.startsWith("/") ? p : path.join(projectRoot, p);

  const serviceAccountJsonPath = (() => {
    const p =
      process.env.SERVICE_ACCOUNT_JSON_PATH ?? userConfig.serviceAccountJsonPath;
    if (!p) return path.join(projectRoot, "config", "service-account.json");
    return resolvePathFromRoot(p);
  })();

  const notifyProvider = String(
    process.env.NOTIFY_PROVIDER ?? userConfig.notifyProvider ?? "discord"
  ).toLowerCase();

  const discordWebhookUrl =
    process.env.DISCORD_WEBHOOK_URL ?? userConfig.discordWebhookUrl ?? "";
  const slackWebhookUrl =
    process.env.SLACK_WEBHOOK_URL ?? userConfig.slackWebhookUrl ?? "";

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
    openaiRetryMax: envNum("OPENAI_RETRY_MAX", userConfig.openaiRetryMax ?? 6),
    openaiRetryBaseMs: envNum(
      "OPENAI_RETRY_BASE_MS",
      userConfig.openaiRetryBaseMs ?? 2000
    ),
    geminiModel:
      process.env.GEMINI_MODEL ?? userConfig.geminiModel ?? "gemini-2.5-flash",
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
      Number(process.env.NEWS_HEADLINE_LIMIT) ||
      userConfig.newsHeadlineLimit ||
      12,
    spreadsheetId,
    sheetRange:
      process.env.SHEET_RANGE ?? userConfig.sheetRange ?? "시트1!A:C",
    serviceAccountJsonPath,
    /** CI에서만 주입하는 경우 */
    serviceAccountJsonRaw:
      process.env.GOOGLE_SERVICE_ACCOUNT ??
      null,
    notifyProvider,
    discordWebhookUrl,
    slackWebhookUrl,
    newsSourceProvider,
    storageProvider,
  };
}
