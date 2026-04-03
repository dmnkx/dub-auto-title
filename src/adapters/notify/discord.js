import { createJsonWebhookNotifier } from "./json_webhook.js";

/**
 * @param {{ webhookUrl: string }} opts
 * @returns {{ send: (message: string) => Promise<void> }}
 */
export function createDiscordNotifier(opts) {
  return createJsonWebhookNotifier({
    webhookUrl: opts.webhookUrl,
    label: "Discord",
    buildPayload: (message) => ({ content: message }),
  });
}
