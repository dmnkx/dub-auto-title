import { resolveConfig } from "./config.js";
import { generateAllTitles } from "./generate_title.js";
import { uploadAllTitles } from "./upload_sheet.js";

export { resolveConfig, projectRoot } from "./config.js";

async function main() {
  const config = resolveConfig();

  console.log("1. 키워드 → 제목 생성 시작");
  const batch = await generateAllTitles(config);

  console.log("2. Google Sheets 업로드 시작");
  await uploadAllTitles(batch, config);

  console.log("✅ 모든 작업 완료");
}

main().catch((err) => console.error(err));
