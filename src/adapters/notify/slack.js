import { createJsonWebhookNotifier } from "./json_webhook.js";

/**
 * Slack Incoming Webhook (간단 텍스트)
 * @param {{ webhookUrl: string }} opts
 * @returns {{ send: (message: string) => Promise<void> }}
 */
export function createSlackNotifier(opts) {
  return createJsonWebhookNotifier({
    webhookUrl: opts.webhookUrl,
    label: "Slack",
    buildPayload: (message) => ({ text: message }),
  });
}
