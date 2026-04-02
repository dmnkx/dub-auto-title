import { readFileSync } from "fs";
import path from "path";
import { projectRoot } from "./config.js";

/**
 * `config/keywords.json` 로딩
 * @returns {unknown}
 */
export function loadKeywords() {
  const p = path.join(projectRoot, "config", "keywords.json");
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw);
}

