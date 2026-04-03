import { resolveConfig } from "./config.js";
import { generateAllTitles } from "./usecases/generate_title.js";
import { uploadAllTitles } from "./usecases/upload_sheet.js";
import { createNotifyClient } from "./adapters/notify/factory.js";

export { resolveConfig, projectRoot } from "./config.js";

/** @type {ReturnType<typeof createNotifyClient> | null} */
let notify = null;

async function main() {
  const config = resolveConfig();
  notify = createNotifyClient(config);

  console.log("1. 키워드 → 제목 생성 시작");
  const batch = await generateAllTitles(config);

  console.log("2. Google Sheets 업로드 시작");
  await uploadAllTitles(batch, config);

  const totalTitles = batch.reduce(
    (sum, { titles }) => sum + (Array.isArray(titles) ? titles.length : 0),
    0
  );
  console.log(`✅ 모든 작업 완료 (총 ${totalTitles}개 제목 업로드)`);
  await notify.send(`✅ dub-auto-title 완료: 총 ${totalTitles}개 제목 업로드 완료`);
}

main().catch(async (err) => {
  console.error(err);
  if (notify) {
    await notify.send(`❌ dub-auto-title 실패: ${err?.message ?? String(err)}`);
  }
  process.exitCode = 1;
});
