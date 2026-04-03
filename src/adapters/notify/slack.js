import axios from "axios";

/**
 * Slack Incoming Webhook (간단 텍스트)
 * @param {{ webhookUrl: string }} opts
 * @returns {{ send: (message: string) => Promise<void> }}
 */
export function createSlackNotifier(opts) {
  const webhookUrl = opts.webhookUrl;
  return {
    async send(message) {
      if (!webhookUrl) return;
      try {
        await axios.post(
          webhookUrl,
          { text: message },
          {
            timeout: 10000,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (err) {
        const detail = err?.response?.data
          ? JSON.stringify(err.response.data)
          : "";
        console.warn(
          `  · Slack 알림 실패: ${err?.message ?? err}${detail ? ` (${detail})` : ""}`
        );
      }
    },
  };
}
