/**
 * Runs testUserEndpoints.js with ALLOW_MISSING_FEATURE_ROUTES=1 so HTTP 404 on
 * newer routes (chat, extras, etc.) does not fail the suite — useful against an older deploy.
 */
process.env.ALLOW_MISSING_FEATURE_ROUTES = "1";
await import("./testUserEndpoints.js");
