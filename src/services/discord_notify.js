import axios from "axios";

/**
 * Discord Webhook 알림 전송
 * - `DISCORD_WEBHOOK_URL` 환경변수가 없으면 no-op
 * - 알림 실패해도 전체 작업은 실패시키지 않음(try/catch 내부 swallow)
 *
 * @param {string} message
 * @returns {Promise<void>}
 */
export async function notifyDiscord(message) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await axios.post(
      webhookUrl,
      { content: message },
      {
        timeout: 10000,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const detail = err?.response?.data ? JSON.stringify(err.response.data) : "";
    console.warn(`  · Discord 알림 실패: ${err?.message ?? err}${detail ? ` (${detail})` : ""}`);
  }
}

