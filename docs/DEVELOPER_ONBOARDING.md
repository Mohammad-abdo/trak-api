# Developer Onboarding (Backend)

## Quick Start

1. Install deps:
```bash
npm install
```
2. Configure `.env` (database, jwt, maps, payment settings).
3. Generate Prisma client:
```bash
npm run prisma:generate
```
4. Run DB migrations/push:
```bash
npm run prisma:migrate
```
or
```bash
npm run prisma:push
```
5. Start dev server:
```bash
npm run dev
```

## Important Files

- `server.js`: app bootstrap, middleware, route mounting, sockets, cron jobs
- `routes/`: endpoint declarations
- `controllers/`: endpoint handlers
- `services/`: shared business workflows
- `middleware/`: auth/security/request context
- `prisma/schema.prisma`: database contract

## Rules for Safe Changes

1. Do not change existing response keys lightly.
2. Add tests before refactoring critical flows.
3. Keep financial operations transactional and idempotent.
4. Use feature flags for potentially breaking behavior.

## Required Reading

- `docs/BACKEND_MODERNIZATION_GUIDE.md`
- `docs/RESPONSE_CONTRACT_POLICY.md`
- `docs/REFACTOR_PLAYBOOK.md`
- `docs/api-contract-baseline.md`

## Suggested Workflow

1. Pick one domain endpoint.
2. Add/verify safety tests.
3. Refactor internals only.
4. Re-run targeted tests.
5. Update docs/changelog.

