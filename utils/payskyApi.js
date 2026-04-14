import crypto from "crypto";

export const PAYSKY_ENV = {
    TEST: {
        JS_URL: "https://grey.paysky.io:9006/invchost/JS/LightBox.js",
        API_BASE: "https://grey.paysky.io",
    },
    PRODUCTION: {
        JS_URL: "https://cube.paysky.io:6006/js/LightBox.js",
        API_BASE: "https://cube.paysky.io",
    },
};

export function getPayskyEnv() {
    const isProduction = process.env.NODE_ENV === "production";
    return isProduction ? PAYSKY_ENV.PRODUCTION : PAYSKY_ENV.TEST;
}

export function getPayskyMerchantId() {
    return String(process.env.PAYSKY_MERCHANT_ID || "").trim();
}

export function getPayskyTerminalId() {
    return String(process.env.PAYSKY_TERMINAL_ID || "").trim();
}

export function getPayskySecretKey() {
    return String(process.env.PAYSKY_SECRET_KEY_HEX || "").trim();
}

export function getPayskyCurrencyNumeric() {
    return String(process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC || "818").trim();
}

export function getAmountMinorUnit(amount, divisor = 100) {
    return Math.round(parseFloat(amount) * divisor);
}

export function getAmountMajorUnit(minorAmount, divisor = 100) {
    return parseFloat(minorAmount) / divisor;
}

export function minorAmountToMajor(minorAmount, divisor = 100) {
    const n = parseInt(minorAmount, 10);
    if (isNaN(n) || n < 0) return null;
    return n / divisor;
}

function buildLightboxSecureHash({ amount, datetime, merchantId, merchantReference, terminalId, secretKeyHex }) {
    const pairs = [
        ["Amount", String(amount)],
        ["DateTimeLocalTrxn", String(datetime)],
        ["MerchantId", String(merchantId)],
        ["MerchantReference", String(merchantReference)],
        ["TerminalId", String(terminalId)],
    ];
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    const canonical = pairs.map(([k, v]) => `${k}=${v}`).join("&");
    const key = Buffer.from(secretKeyHex.replace(/\s+/g, ""), "hex");
    return crypto.createHmac("sha256", key).update(canonical, "utf8").digest("hex").toUpperCase();
}

export function verifyLightboxSecureHash(params) {
    const { Amount, DateTimeLocalTrxn, MerchantId, MerchantReference, TerminalId, SecureHash } = params;
    const secretKey = getPayskySecretKey();
    if (!secretKey) return false;
    const expected = buildLightboxSecureHash({
        amount: Amount,
        datetime: DateTimeLocalTrxn,
        merchantId: MerchantId,
        merchantReference: MerchantReference,
        terminalId: TerminalId,
        secretKeyHex: secretKey,
    });
    try {
        const a = Buffer.from(String(SecureHash || "").toUpperCase(), "hex");
        const b = Buffer.from(expected, "hex");
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

export function isPayskyConfigured() {
    return !!(getPayskyMerchantId() && getPayskyTerminalId() && getPayskySecretKey());
}

export function generatePayskyPaymentConfig({ merchantReference, amountMinor }) {
    const merchantId = getPayskyMerchantId();
    const terminalId = getPayskyTerminalId();
    const secretKey = getPayskySecretKey();
    const currency = getPayskyCurrencyNumeric();
    const datetime = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
    const secureHash = buildLightboxSecureHash({
        amount: amountMinor,
        datetime,
        merchantId,
        merchantReference: String(merchantReference),
        terminalId,
        secretKeyHex: secretKey,
    });
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    return {
        merchantId,
        terminalId,
        currency,
        amountTrxn: amountMinor,
        merchantReference: String(merchantReference),
        transactionDatetime: datetime,
        secureHash,
        expiresAt: expiresAt.toISOString(),
        paymentPageUrl: `${getPayskyEnv().JS_URL}`.replace("/JS/LightBox.js", ""),
    };
}
