import { readFileSync } from "fs";
import path from "path";
import { projectRoot } from "./config.js";

/**
 * `config/keywords.json` 로딩
 * @param {{ projectRoot?: string }} [options] 테스트·스크립트에서 루트만 바꿀 때
 * @returns {unknown}
 */
export function loadKeywords(options = {}) {
  const root = options.projectRoot ?? projectRoot;
  const p = path.join(root, "config", "keywords.json");
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw);
}
