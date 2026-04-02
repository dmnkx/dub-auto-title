# dub-auto-title

`dub-auto-title`은 다음 작업을 “자동으로” 해주는 Node.js 프로젝트입니다.

1. `config/keywords.json`에 있는 키워드들을 가져옵니다.
2. 각 키워드로 Google 뉴스 RSS를 조회해서 최근 기사 제목(단서)을 모읍니다.
3. Gemini(AI)로 “블로그 글 제목 후보 5개”를 생성합니다.
4. 생성된 결과를 Google Sheets에 업로드합니다.
5. (선택) 작업이 끝나면 Discord로 알림을 보냅니다.

처음 개발을 배우는 학생도 바로 실행할 수 있도록, 아래에 “준비물 → 설정 → 실행 → 확인” 순서로 설명합니다.

---

## 1) 준비물

아래 항목이 필요합니다.

- Node.js 18+ (가능하면 20+)
- Gemini API 키
- Google Sheets 접근 권한(서비스 계정 or CI에서 제공되는 JSON)
- Google Sheets 스프레드시트 ID
- (선택) Discord Webhook URL

---

## 2) 폴더 구조(역할별 분리)

이 프로젝트는 기능을 섞지 않도록 폴더 규칙을 지켜서 나눴습니다.

- `src/services/`
  - 외부 연동(네트워크/외부 API)을 담당합니다.
  - 예: Google Sheets 업로드, Google News RSS 조회, Gemini 호출, Discord 알림
- `src/usecases/`
  - “실제 실행 흐름”을 조립합니다.
  - 예: 키워드별 제목 생성 흐름, 시트 업로드 흐름
- `src/lib/`
  - 외부 연동 없이 재사용하는 유틸(시간 포맷, 파싱, sleep 등)만 둡니다.

자세한 폴더 규칙은 `FOLDER_RULES.md`를 참고하세요.

---

## 3) Google Sheets에 들어가는 컬럼(중요)

현재 기본 업로드 대상은 아래 범위를 사용합니다.

- `sheetRange`: `시트1!A:C`

업로드되는 값의 의미(열 순서)는 다음과 같습니다.

- A열: KST 기준 타임스탬프 (`YYYY-MM-DD HH:mm:ss`)
- B열: 키워드
- C열: 생성된 제목

### 팁(필요하면)

Sheets에서 `A열`을 기준으로 `arrayformula` 같은 계산을 하고 있다면,
`A열`에 들어가는 값이 “진짜 날짜/시간으로 인식”되어야 합니다.

그래서 이 프로젝트는 Sheets 업로드 시 `valueInputOption: "USER_ENTERED"`를 사용합니다.
또한 A열 값은 ISO-8601 스타일로 만들어 넣습니다.

---

## 4) 설정 파일 / 환경 변수

### 4.1 키워드 목록

- `config/keywords.json`
  - 예:
    ```json
    ["AI 활용","업무 자동화","AI 자동화"]
    ```

이 파일에 키워드를 넣으면, 프로젝트가 자동으로 각 키워드에 대해 제목 5개씩 생성합니다.

### 4.2 Gemini 설정

- 환경 변수: `GEMINI_API_KEY`

Gemini API 키를 넣어야 합니다.

### 4.3 Google Sheets 설정

아래 2개 중 1세트를 준비합니다.

1) 스프레드시트 ID
- 환경 변수: `SPREADSHEET_ID`
  - 값은 Google Sheets URL에서 `/d/` 다음의 문자열입니다.

2) Sheets 업로드 권한(서비스 계정)
- 로컬 실행: `config/service-account.json` 파일 사용(프로젝트에서 gitignore 처리됨)
- GitHub Actions/CI: `GOOGLE_SERVICE_ACCOUNT` 환경 변수에 서비스 계정 JSON 문자열 제공

### 4.4 업로드 범위(sheetRange)

- 환경 변수: `SHEET_RANGE`
- 기본값: `시트1!A:C`

시트 탭 이름이 `시트1`이 아니거나, 범위를 바꾸고 싶다면 `SHEET_RANGE`를 수정하세요.

### 4.5 (선택) Discord 알림

- 환경 변수: `DISCORD_WEBHOOK_URL`
  - 이 값이 없으면 Discord 알림은 보내지 않습니다(no-op).

---

## 5) 로컬에서 실행하기(가장 일반적인 방법)

1. 패키지 설치
   ```bash
   npm install
   ```

2. 환경 변수 설정
   - `.env` 파일을 쓰든, 터미널에서 `export` 하든 상관 없습니다.
   - 필요한 값:
     - `GEMINI_API_KEY`
     - `SPREADSHEET_ID`
     - (로컬) `config/service-account.json` 파일 준비
     - (선택) `DISCORD_WEBHOOK_URL`
     - (선택) `SHEET_RANGE`

3. 실행
   ```bash
   npm start
   ```

실행 흐름은 아래처럼 로그로 표시됩니다.

- 1) 키워드별 제목 생성 시작
- 2) Google Sheets 업로드 시작
- 3) 완료(Discord 알림은 선택)

---

## 6) GitHub Actions(자동 실행)

이 레포는 `.github/workflows/generate.yml`에서 매일 실행되도록 설정되어 있습니다.

- 스케줄: 매일 01:00 UTC(UTC 기준, 한국 시간으로는 +9)
- 사용되는 시크릿:
  - `GEMINI_API_KEY`
  - `GOOGLE_SERVICE_ACCOUNT`
  - `SPREADSHEET_ID`
  - `DISCORD_WEBHOOK_URL` (선택)

CI에서는 로컬에 `config/service-account.json` 파일이 없어도 동작하도록,
`GOOGLE_SERVICE_ACCOUNT`로 인증 정보를 주입합니다.

---

## 7) 트러블슈팅(자주 생기는 문제)

### Q1. A열에 데이터가 이상하게 들어가요

아래를 먼저 확인해 주세요.

- `SHEET_RANGE`가 정말 `시트1!A:C`인지
- 스프레드시트 탭 이름이 코드/설정과 같은지(특히 `시트1` 여부)

이 프로젝트는 A열=타임스탬프, B열=키워드, C열=제목 순서로 3열을 업로드합니다.

### Q2. 날짜가 텍스트로만 보이고 계산이 안 돼요

프로젝트 업로드 옵션은 `USER_ENTERED`로 되어 있어야 정상 동작합니다.
또한 A열 값은 날짜/시간으로 파싱되기 쉬운 형태로 전송합니다.

계속 문제가 있으면:
- Sheets에서 해당 열의 표시 형식(Format)이 “일반 텍스트”인지 확인
- 기존 데이터/서식이 오래돼서 꼬였는지 확인

---

## 8) 다음으로 개선할 수 있는 것(선택)

학생이 더 확장해보고 싶다면 아래를 개선 과제로 추천합니다.

- 업로드 전에 “헤더(row 1)”가 있는지 체크하고 맞춰서 업로드
- Discord 메시지에 실행 시간/에러 키워드까지 포함
- Google Sheets 업데이트 범위 자동 검증(예: 범위 파싱)

