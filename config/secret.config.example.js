/**
 * 로컬 시크릿 템플릿 — 이 파일을 복사해 `secret.config.js`로 저장하세요.
 * `secret.config.js`는 git에 올리지 마세요(.gitignore 처리).
 *
 * 우선순위: secret.config.js 값 → 동일 이름의 환경 변수 → (해당 없으면 빈 값/기본 경로)
 */
export const secretConfig = {
  geminiApiKey: "",
  openaiApiKey: "",
  /** 서비스 계정 JSON 파일 경로(프로젝트 루트 기준 상대 경로 권장). 비우면 `config/service-account.json` */
  serviceAccountJsonPath: "",
  /** 서비스 계정 JSON 전체를 문자열로 넣을 때(CI의 `GOOGLE_SERVICE_ACCOUNT`와 동일 역할). 파일보다 우선하지 않음—둘 중 하나만 써도 됨 */
  googleServiceAccount: "",
  discordWebhookUrl: "",
  slackWebhookUrl: "",
};
