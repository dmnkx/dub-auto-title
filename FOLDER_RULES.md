# Folder Rules

프로젝트의 폴더/파일 역할을 일정하게 유지하기 위한 규칙입니다.

## 1) `src/` 최상위
- 애플리케이션 “순수 정의”를 둡니다(상태/IO 최소화).
- 예시
  - `src/prompts.js`: 프롬프트/포맷 빌더(순수 함수)
  - `src/config.js`: 실행 설정 로더/검증
  - `src/lib/`: 공통 유틸(순수/계산 위주)

## 2) `src/lib/`
- IO(네트워크/파일/외부 API) 없이 재사용 가능한 유틸만 둡니다.
- 예시
  - `src/lib/time.js`: 시간 포맷팅
  - `src/lib/title_parser.js`: Gemini 응답 파싱
  - `src/lib/sleep.js`: 지연 유틸

## 3) `src/services/`
- 외부 연동/사이드이펙트(네트워크, Google API, RSS fetch, Discord webhook 등)를 담당합니다.
- “도메인 로직”을 넣지 말고, 외부 API를 어댑터 형태로 감싸 둡니다.
- 예시
  - `src/services/news_rss.js`: Google News RSS 조회
  - `src/services/google_sheets.js`: Google Sheets append
  - `src/services/gemini_api.js`: Gemini generateContent 호출
  - `src/services/discord_notify.js`: Discord webhook 알림

## 4) `src/usecases/`
- 실제 실행 흐름(유스케이스)을 조립합니다.
- services/lib를 호출해 “무엇을 할지”를 구현하지만, 외부 API 호출 자체 로직은 services로 위임합니다.
- 예시
  - `src/usecases/generate_title.js`: 키워드별 제목 생성 흐름
  - `src/usecases/upload_sheet.js`: 시트 업로드 페이로드 생성 + 업로드 호출

## 5) 네이밍 규칙
- 파일명: 소문자 + `_` 또는 `-` 사용(현재 코드는 `_`를 주로 사용 중)
- 함수명: camelCase
- 상수: UPPER_SNAKE_CASE
- 서비스/유틸은 “역할이 드러나는 이름”을 우선합니다.

## 6) import 규칙(간단)
- `usecases/*` 는 `services/*` 와 `lib/*` 를 import합니다.
- `services/*` 는 `lib/*` 를 import해 계산/포맷만 재사용합니다(가능하면 domain 의존을 줄임).

