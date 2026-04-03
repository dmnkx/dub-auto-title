/**
 * 민감정보는 노출하지 않고 resolve된 앱 설정만 요약 출력
 * @param {object} config resolveConfig() 결과
 * @param {{ log?: typeof console.log }} [io]
 */
export function logResolvedConfigSummary(config, io = console) {
  const { log } = io;
  log("0. 실행 설정 요약");
  log(
    `  · llmProvider=${config.llmProvider}, geminiModel=${config.geminiModel}, openaiModel=${config.openaiModel}`
  );
  log(
    `  · 뉴스 limit=${config.newsHeadlineLimit}, sheetRange=${config.sheetRange}`
  );
  log(
    `  · notifyProvider=${config.notifyProvider} (discordWebhookUrl=${
      config.discordWebhookUrl ? "set" : "empty"
    }, slackWebhookUrl=${config.slackWebhookUrl ? "set" : "empty"})`
  );
  log(
    `  · API key 유무 (geminiApiKey=${
      config.geminiApiKey ? "set" : "empty"
    }, openaiApiKey=${config.openaiApiKey ? "set" : "empty"})`
  );
  log(
    `  · serviceAccount (path=${config.serviceAccountJsonPath}, raw=${
      config.serviceAccountJsonRaw ? "set" : "empty"
    })`
  );
  log(
    `  · retry (gemini: max=${config.geminiRetryMax}, baseMs=${config.geminiRetryBaseMs}; openai: max=${config.openaiRetryMax}, baseMs=${config.openaiRetryBaseMs})`
  );
}
