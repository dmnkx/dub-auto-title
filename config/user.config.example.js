/**
 * 1) 이 파일을 복사해 `config/user.config.js` 를 만든 뒤 값을 채우세요.
 *    cp config/user.config.example.js config/user.config.js
 * 2) `user.config.js` 는 비밀값이 들어가므로 git에 커밋하지 마세요. (.gitignore 됨)
 * 3) API 키는 여기 대신 환경 변수 GEMINI_API_KEY 만 써도 됩니다.
 */
export const userConfig = {
  /** Google AI Studio 등에서 발급 (https://aistudio.google.com/app/apikey) */
  geminiApiKey: "",
  /** 예: gemini-2.0-flash, gemini-1.5-flash */
  geminiModel: "gemini-2.0-flash",
  /**
   * Gemini 응답 최대 출력 토큰. JSON 제목 5개는 1024로는 잘리는 경우가 많아 기본 8192 권장
   */
  geminiMaxOutputTokens: 8192,
  /**
   * Gemini 429(할당량) 완화: 첫 요청 실패 시 최대 재시도 횟수(지수 백오프)
   */
  geminiRetryMax: 6,
  /** 재시도 대기 기준(ms). 실제 대기는 이 값 × 2^시도 */
  geminiRetryBaseMs: 2000,
  /** 키워드마다 요청 사이 간격(ms). 무료/낮은 한도일 때 늘리면 도움 */
  delayBetweenKeywordsMs: 2500,
  /** 뉴스 RSS에서 가져올 최근 기사 제목 개수 */
  newsHeadlineLimit: 12,
  /** 구글 스프레드시트 URL의 /d/ 뒤 ID */
  spreadsheetId: "",
  /** 시트 탭 이름·열 범위 (키워드·제목 2열) */
  sheetRange: "Sheet1!A:B",
  /**
   * 서비스 계정 JSON 파일 경로 (프로젝트 루트 기준 상대 경로 권장)
   * 이 파일도 git에 올리지 마세요.
   */
  serviceAccountJsonPath: "./service-account.json",
};
