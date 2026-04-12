# API regression baseline (OTP, wallet-related payments)

Snapshot for refactors. Status codes and JSON shapes must stay compatible unless versioned.

## Web auth (`/api/auth`)

| Route | Method | Success | Errors |
|-------|--------|---------|--------|
| `/api/auth/submit-otp` | POST (Bearer) | 200 `{ success: true, message: "Account verified successfully" }` | 400 missing/invalid/expired OTP; 404 user; 401 no token |
| `/api/auth/resend-otp` | POST | 200 `{ success: true, message: "OTP sent successfully" }` | 400 already verified; 404 user; 400 missing phone |

## Mobile user (`/apimobile/user/auth`)

| Route | Method | Success | Notes |
|-------|--------|---------|--------|
| `/apimobile/user/auth/submit-otp` | POST (Bearer) | 200 `{ success, message, data: { token, user } }` | Sets `status: active`, clears OTP fields, `isVerified: true` |
| `/apimobile/user/auth/resend-otp` | POST | 200 `{ success, message, token }` | Top-level `token` (not only under `data`) |
| `/apimobile/user/auth/send-otp` | POST (Bearer) | 200 `{ success, message }` | |

## Mobile driver (`/apimobile/driver/auth`)

Uses `controllers/auth/otp.js` for `submit-otp` and `resend-otp` (same bodies as web auth table). Uses user `mobileAuthController` for `send-otp`, `forgot-password`, `reset-password`.

## Payments / wallet debit

| Route | Method | Success | Wallet behavior |
|-------|--------|---------|-------------------|
| `POST /api/payments/save-payment` | Private | 200 `{ success, message, data: payment }` | If `paymentType === "wallet"` and balance sufficient: debit rider + `WalletHistory` debit `ride_payment`; driver credit path unchanged |
| `POST /api/rides/schedule` | Private | 201 `{ success, message, data: { ride, payment } }` | In transaction: if `paymentType === "wallet"`, throws on insufficient balance; else same debit + history as above |

## Admin security audit (optional)

Requires `SecurityAuditLog` table (`prisma db push` / migrate) and `SECURITY_AUDIT_LOG_ENABLED=1`.

| Route | Method | Success |
|-------|--------|---------|
| `/api/admin/security-logs` | GET (admin Bearer) | 200 `{ success, data, pagination }` — query: `category`, `user_id`, `page`, `per_page`, `from_date`, `to_date` |

## Env (debugging / audit)

| Variable | Purpose |
|----------|---------|
| `TRUST_PROXY` | `1` / `true` / hop count so `req.ip` and `X-Forwarded-For` are correct behind a proxy |
| `HTTP_ACCESS_LOG` | `1` enables one JSON line per finished request (`requestId`, path, status, `ip`) |
| `SECURITY_AUDIT_LOG_ENABLED` | `1` persists allowlisted OTP / payment / map requests to `security_audit_logs` |
