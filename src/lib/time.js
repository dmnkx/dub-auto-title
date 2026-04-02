function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Asia/Seoul(KST, UTC+9) 타임스탬프를 Sheets가 날짜/시간으로 파싱하기 쉬운
 * ISO-8601 형태로 만든다.
 * @param {Date} [d]
 * @returns {string} YYYY-MM-DDTHH:mm:ss+09:00
 */
export function formatKstTimestamp(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);

  return `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(
    kst.getUTCDate()
  )}T${pad2(kst.getUTCHours())}:${pad2(kst.getUTCMinutes())}:${pad2(
    kst.getUTCSeconds()
  )}+09:00`;
}

