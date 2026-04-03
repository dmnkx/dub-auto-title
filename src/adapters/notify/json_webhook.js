import axios from "axios";
import { isLogVerbose } from "../../lib/env.js";
import { previewOneLine } from "../../lib/string.js";

/**
 * JSON 바디 웹훅 전송(Discord content / Slack text 등)
 * @param {{
 *   webhookUrl: string
 *   label: string
 *   buildPayload: (message: string) => object
 * }} opts
 * @returns {{ send: (message: string) => Promise<void> }}
 */
export function createJsonWebhookNotifier(opts) {
  const { webhookUrl, label, buildPayload } = opts;
  return {
    async send(message) {
      const verbose = isLogVerbose();
      if (!webhookUrl) return;
      try {
        if (verbose) {
          const { preview, truncated, length } = previewOneLine(message, 140);
          console.log(
            `  · [${label}] send start (len=${length}, preview="${preview}${truncated ? "…" : ""}")`
          );
        }
        await axios.post(webhookUrl, buildPayload(message), {
          timeout: 10000,
          headers: { "Content-Type": "application/json" },
        });
        if (verbose) {
          console.log(`  · [${label}] send 완료`);
        }
      } catch (err) {
        const detail = err?.response?.data
          ? JSON.stringify(err.response.data)
          : "";
        console.warn(
          `  · ${label} 알림 실패: ${err?.message ?? err}${detail ? ` (${detail})` : ""}`
        );
      }
    },
  };
}
