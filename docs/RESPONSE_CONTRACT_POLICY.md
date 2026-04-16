# Response Contract Policy

This policy protects mobile apps, dashboards, and integrations from accidental breaking changes.

## Stability Rules

1. Do not rename existing keys in JSON responses.
2. Do not remove existing keys unless endpoint is versioned.
3. Do not change key data types (`string` to `number`, etc.).
4. Do not change success/error status codes without migration plan.
5. Additive fields are allowed (optional by default).

## Endpoint Change Levels

- **Safe**: Internal refactor, no request/response change.
- **Compatible**: Add optional fields, extra metadata.
- **Breaking**: Remove/rename fields, status changes, route changes.

Breaking changes require:
- versioned endpoint (`/v2/...`) or explicit migration window.

## Required Checks Before Merge

1. Update tests for affected endpoints.
2. Confirm no contract regression in existing responses.
3. Update docs/changelog.
4. Confirm mobile + frontend compatibility.

## Suggested Contract Test Scope

- Auth (`/api/auth`, `/apimobile/*/auth`)
- Booking create/list/status
- Offer flow (near drivers, accept/cancel/track/end)
- Payment callback + wallet updates
- Driver ride actions

## Existing Baseline

Use and keep updated:
- `docs/api-contract-baseline.md`

