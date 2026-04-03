import { createDiscordNotifier } from "./discord.js";
import { createSlackNotifier } from "./slack.js";
import { createNoopNotifier } from "./noop.js";
import { isLogVerbose } from "../../lib/env.js";

/**
 * @param {object} config
 * @param {string} [config.notifyProvider] discord | slack | none
 * @param {string} [config.discordWebhookUrl]
 * @param {string} [config.slackWebhookUrl]
 * @returns {{ send: (message: string) => Promise<void> }}
 */
export function createNotifyClient(config) {
  const verbose = isLogVerbose();

  const provider = String(config.notifyProvider ?? "discord").toLowerCase();
  if (verbose) {
    console.log(
      `  · [Notify] provider=${provider} (discordWebhookUrl=${
        config.discordWebhookUrl ? "set" : "empty"
      }, slackWebhookUrl=${config.slackWebhookUrl ? "set" : "empty"})`
    );
  }

  if (provider === "none") {
    return createNoopNotifier();
  }

  if (provider === "slack") {
    const url = config.slackWebhookUrl ?? "";
    if (!url) return createNoopNotifier();
    return createSlackNotifier({ webhookUrl: url });
  }

  if (provider === "discord") {
    const url = config.discordWebhookUrl ?? "";
    if (!url) return createNoopNotifier();
    return createDiscordNotifier({ webhookUrl: url });
  }

  console.warn(`  · 알 수 없는 NOTIFY_PROVIDER: ${provider}, 알림 비활성`);
  return createNoopNotifier();
}
