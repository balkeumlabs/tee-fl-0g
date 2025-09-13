/**
 * scripts/_argv_prep.cjs
 * Guarantee "--attestation" has a string path value before any arg parser runs,
 * and set TEE_ATTEST_FILE to the resolved path for code that prefers env.
 */
(() => {
  try {
    const path = require("node:path");
    const argv = process.argv;
    const FLAG = "--attestation";

    let attPath = process.env.TEE_ATTEST_FILE || null;
    const idx = argv.indexOf(FLAG);
    let needsInject = false;

    if (idx !== -1) {
      const next = argv[idx + 1];
      const bad =
        next === undefined ||
        next === true ||
        next === "true" ||
        (typeof next === "string" && next.startsWith("-"));
      if (bad) { needsInject = true; } else { attPath = attPath || String(next); }
    } else {
      needsInject = true;
    }

    if (!attPath) attPath = "attestation_sample.json";
    const resolved = path.resolve(attPath);
    process.env.TEE_ATTEST_FILE = resolved;

    if (needsInject) {
      if (idx === -1) argv.push(FLAG, resolved);
      else            argv.splice(idx + 1, 0, resolved);
    }
  } catch (e) {
    console.error("[attest-preload] failed:", (e && e.message) || e);
  }
})();
