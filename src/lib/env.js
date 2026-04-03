/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isLogVerbose(env = process.env) {
  return String(env.LOG_VERBOSE ?? "true").toLowerCase() === "true";
}

/**
 * @param {string} envKey
 * @param {number} fallback
 * @param {NodeJS.ProcessEnv} [env]
 */
export function readEnvNumber(envKey, fallback, env = process.env) {
  const v = env[envKey];
  if (v !== undefined && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}
