# Backend Modernization Guide (Safe, Non-Breaking)

This guide explains how to modernize this backend **without breaking existing endpoints, response shapes, or clients**.

## 1) Ground Rules (Do Not Break)

1. Keep all existing routes and HTTP methods unchanged.
2. Keep existing response keys unchanged.
3. Add new response fields only as optional/additive.
4. Preserve current status codes unless explicitly versioning.
5. Prefer feature flags for new behavior.

## 2) Current Structure (High-Level)

- `server.js` = app bootstrap + middleware + route registration + sockets + cron
- `routes/` = endpoint map
- `controllers/` = request handlers
- `services/` = shared business workflows
- `utils/` = helper functions/integrations
- `middleware/` = auth/security/request context
- `prisma/` = schema + migrations + seeders
- `tests/` = regression/safety tests

## 3) Target Modern Structure (Incremental)

Do this in phases; do not move everything at once.

### Phase A: Documentation + Safety Tests
- Add contract tests for critical APIs.
- Freeze response contracts in docs.
- Add architecture docs and coding conventions.

### Phase B: Introduce Domain Modules (No Route Changes)
- Keep existing `routes/*` files.
- Move business logic from large controllers into domain services:
  - `domains/booking/`
  - `domains/offer/`
  - `domains/payment/`
  - `domains/wallet/`
- Controllers become thin adapters only.

### Phase C: Shared Infrastructure Layer
- Add `infrastructure/` for external integrations:
  - socket, mqtt, payment gateway, sms, notifications
- Keep current utility wrappers and migrate gradually.

### Phase D: Validation Standardization
- Add request validation middleware per route group.
- Reject malformed payloads early.
- Keep response shape/messages stable where clients depend on them.

### Phase E: Operational Hardening
- Health probes (`/health`, `/health/live`, `/health/ready`)
- Security headers and rate limits
- Structured logs + requestId everywhere
- Graceful shutdown + dependency readiness checks

## 4) Safe Refactor Pattern

For each endpoint:

1. Add/confirm regression test for existing behavior.
2. Extract logic into service function.
3. Keep controller input/output contract unchanged.
4. Run targeted tests.
5. Ship behind flag if behavior could change.

## 5) Recommended New Folders (Additive)

You can add these without deleting current folders:

```txt
src/
  app/
    bootstrap/
    middleware/
    routing/
  domains/
    booking/
    offer/
    payment/
    wallet/
  infrastructure/
    db/
    realtime/
    payments/
  shared/
    utils/
    errors/
    contracts/
```

Keep old paths active during migration. Move module-by-module only.

## 6) Definition of Done for "Non-Breaking"

- All safety tests pass.
- Existing frontend/mobile clients work with no code changes.
- Existing route URLs and response keys remain valid.
- Any behavior change is controlled by env flag or new endpoint.

