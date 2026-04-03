# Folder Rules

프로젝트의 폴더/파일 역할을 일정하게 유지하기 위한 규칙입니다.

## 1) `src/` 최상위
- 애플리케이션 “순수 정의”를 둡니다(상태/IO 최소화).
- 예시
  - `src/prompts.js`: 프롬프트/포맷 빌더(순수 함수)
  - `src/config.js`: 실행 설정 로더/검증
  - `src/lib/`: 공통 유틸(순수/계산 위주)
  - `src/index.js`: 진입점(유스케이스 조립·알림 연결)

## 2) `src/lib/`
- IO(네트워크/파일/외부 API) 없이 재사용 가능한 유틸만 둡니다.
- 예시
  - `src/lib/time.js`: 시간 포맷팅
  - `src/lib/title_parser.js`: LLM 응답 파싱
  - `src/lib/sleep.js`: 지연 유틸

## 3) `src/adapters/` (외부 연동 래퍼)
- **구현체를 바꿔 끼울 수 있게** 공통 형태로 감쌉니다.
- 유스케이스는 “어떤 API인지”가 아니라 **인터페이스(클라이언트)** 만 알면 됩니다.
- 하위 폴더
  - `src/adapters/llm/`: 텍스트 생성 (Gemini / OpenAI 등, `factory.js`로 선택)
  - `src/adapters/notify/`: 알림 (Discord / Slack 등, `factory.js`로 선택)
  - `src/adapters/storage/`: 저장소 (Google Sheets 등, `factory.js`로 선택)
  - `src/adapters/news/`: 뉴스/이슈 단서 수집 (Google News RSS 등, `factory.js`로 선택)

## 4) `src/usecases/`
- 실제 실행 흐름(유스케이스)을 조립합니다.
- `adapters/*`의 팩토리로 클라이언트를 만든 뒤, 도메인 로직만 수행합니다.
- 예시
  - `src/usecases/generate_title.js`: 키워드별 제목 생성 흐름
  - `src/usecases/upload_sheet.js`: 업로드 페이로드 생성 + storage 클라이언트 호출

## 5) 네이밍 규칙
- 파일명: 소문자 + `_` 또는 `-` 사용(현재 코드는 `_`를 주로 사용 중)
- 함수명: camelCase
- 상수: UPPER_SNAKE_CASE
- 어댑터 팩토리: `createXxxClient`, `createXxxStorage` 등 역할이 드러나게

## 6) import 규칙(간단)
- `usecases/*` → `adapters/*/factory.js`, `lib/*`, `prompts.js`, `config.js` 등
- `adapters/*` 구현 파일 → `lib/*` 재사용 가능, **유스케이스 import 금지**(역방향 의존 방지)
