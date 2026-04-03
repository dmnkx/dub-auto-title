/**
 * 로컬·CI 공통으로 써도 되는 비시크릿 설정(git에 포함됩니다).
 * 시크릿은 `secret.config.example.js`를 참고해 `secret.config.js`에 두거나 환경 변수를 쓰세요.
 */
export const userConfig = {
  /** 예: gemini-2.0-flash, gemini-1.5-flash */
  geminiModel: "gemini-2.5-flash-lite",
  /**
   * Gemini 응답 최대 출력 토큰. JSON 제목 5개는 1024로는 잘리는 경우가 많아 기본 8192 권장
   */
  geminiMaxOutputTokens: 8192,
  /** 뉴스 RSS에서 가져올 최근 기사 제목 개수 */
  newsHeadlineLimit: 12,
  /** 구글 스프레드시트 URL의 /d/ 뒤 ID — CI에서는 보통 `SPREADSHEET_ID` 환경 변수 사용 */
  spreadsheetId: "",
  /** 시트 탭 이름·열 범위 (날짜·키워드·제목 3열) */
  sheetRange: "시트1!A:C",

  /** LLM: "gemini" | "openai" — 환경변수 LLM_PROVIDER 로도 설정 가능 */
  // llmProvider: "gemini",
  /** OpenAI 사용 시 모델 — 환경변수 OPENAI_MODEL 로도 설정 가능 */
  // openaiModel: "gpt-4o-mini",

  /** 알림: "discord" | "slack" | "none" — 환경변수 NOTIFY_PROVIDER */
  // notifyProvider: "discord",
};
