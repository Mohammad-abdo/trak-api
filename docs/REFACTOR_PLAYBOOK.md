# Refactor Playbook (For Developers)

Use this checklist before touching large files or sensitive workflows.

## 1) Before You Change Code

1. Identify endpoint(s) and controller(s) affected.
2. Find existing tests and add missing safety tests first.
3. Snapshot current response shape.
4. Note dependent frontend/mobile screens.

## 2) During Refactor

1. Keep controller contract the same.
2. Move logic into service functions gradually.
3. Keep route registration unchanged.
4. Use transactions for multi-step money/state updates.
5. Keep idempotency protections for payment/webhook paths.

## 3) Validation Pattern

- Validate request payload at route/controller boundary.
- Reject invalid input early with stable error responses.
- Avoid hidden coercion for IDs, rates, coordinates.

## 4) Real-Time/Event Pattern

- Treat socket events like API contracts.
- Validate identity before joining rooms when auth enforcement is enabled.
- Keep backward compatibility behind env flags.

## 5) Merge Checklist

1. `npm run test -- <targeted-test-files>`
2. Confirm no response key changes.
3. Confirm no route/method changes.
4. Update docs if behavior changed.
5. Add rollout notes and fallback flag if needed.

## 6) Rollout Strategy

- Phase rollout:
  1. Additive change off by default
  2. Enable in staging
  3. Canary in production
  4. Full rollout

## 7) Common Anti-Patterns to Avoid

- Massive one-shot file moves
- Mixed business logic + transport logic + DB logic in one function
- Silent contract changes without tests
- Global behavior switches without flags

