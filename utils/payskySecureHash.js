import crypto from "crypto";

/**
 * PaySky OMNI Notification Services — Appendix A secure hash.
 * Canonical string: Amount, Currency, DateTimeLocalTrxn, MerchantId, TerminalId
 * sorted by parameter name, joined as name=value&...
 * HMAC-SHA256 with hex-decoded merchant secret key; digest uppercase hex.
 */
export function buildPayskySignatureString({ Amount, Currency, DateTimeLocalTrxn, MerchantId, TerminalId }) {
    const pairs = [
        ["Amount", String(Amount ?? "").trim()],
        ["Currency", String(Currency ?? "").trim()],
        ["DateTimeLocalTrxn", String(DateTimeLocalTrxn ?? "").trim()],
        ["MerchantId", String(MerchantId ?? "").trim()],
        ["TerminalId", String(TerminalId ?? "").trim()],
    ];
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

export function computePayskySecureHash(canonicalString, merchantSecretKeyHex) {
    const keyHex = String(merchantSecretKeyHex ?? "").replace(/\s+/g, "");
    if (!keyHex || keyHex.length % 2 !== 0) {
        throw new Error("Invalid PAYSKY secret key hex");
    }
    const key = Buffer.from(keyHex, "hex");
    return crypto.createHmac("sha256", key).update(canonicalString, "utf8").digest("hex").toUpperCase();
}

export function verifyPayskySecureHash(body, merchantSecretKeyHex) {
    const received = String(body.SecureHash ?? "").replace(/\s+/g, "").toUpperCase();
    if (!received) return false;
    const canonical = buildPayskySignatureString({
        Amount: body.Amount,
        Currency: body.Currency,
        DateTimeLocalTrxn: body.DateTimeLocalTrxn,
        MerchantId: body.MerchantId,
        TerminalId: body.TerminalId,
    });
    const expected = computePayskySecureHash(canonical, merchantSecretKeyHex);
    try {
        const a = Buffer.from(received, "hex");
        const b = Buffer.from(expected, "hex");
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}
