import prisma from "../utils/prisma.js";
import crypto from "crypto";
import { getPayskyEnv } from "./payskyApi.js";

function getCardPayEndpoint(env) {
    const explicit = String(process.env.PAYSKY_CARD_PAY_URL || "").trim();
    if (explicit) return explicit;
    return `${env.API_BASE}/api/v1/payments/pay`;
}

function getTokenPayEndpoint(env) {
    const explicit = String(process.env.PAYSKY_TOKEN_PAY_URL || "").trim();
    if (explicit) return explicit;
    return `${env.API_BASE}/api/v1/payments/token-pay`;
}

async function parseGatewayResponseSafe(response) {
    const rawText = await response.text();
    let parsed = null;
    try {
        parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
        parsed = null;
    }
    return { parsed, rawText };
}

function normalizeGatewayResult(response, payload) {
    const parsed = payload?.parsed;
    const rawText = payload?.rawText || "";
    const responseCode = parsed?.ResponseCode ?? parsed?.responseCode ?? null;
    const status = parsed?.Status ?? parsed?.status ?? null;
    const message =
        parsed?.ResponseMessage ||
        parsed?.message ||
        parsed?.Message ||
        (rawText ? rawText.slice(0, 300) : `Gateway HTTP ${response.status}`);
    const systemReference = parsed?.SystemReference ?? parsed?.systemReference ?? null;
    const merchantReference = parsed?.MerchantReference ?? parsed?.merchantReference ?? null;
    const success = response.ok && (responseCode === "0000" || String(status).toUpperCase() === "SUCCESS");

    return {
        success,
        responseCode,
        systemReference,
        merchantReference,
        message,
        httpStatus: response.status,
        rawResponse: parsed ?? rawText,
    };
}

export async function processPayskyCardPayment({ amount, cardNumber, expiryMonth, expiryYear, cvv, cardHolderName, merchantReference, userId }) {
    const merchantId = process.env.PAYSKY_MERCHANT_ID?.trim();
    const terminalId = process.env.PAYSKY_TERMINAL_ID?.trim();
    const secretKey = process.env.PAYSKY_SECRET_KEY_HEX?.trim();
    const currency = process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC?.trim() || "818";
    const env = getPayskyEnv();

    if (!merchantId || !terminalId || !secretKey) {
        throw new Error("Paysky not configured");
    }

    // Amount in minor units (halalas for EGP)
    const amountMinor = Math.round(amount * 100);
    const datetime = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);

    // Build secure hash
    const pairs = [
        ["Amount", String(amountMinor)],
        ["DateTimeLocalTrxn", String(datetime)],
        ["MerchantId", String(merchantId)],
        ["MerchantReference", String(merchantReference)],
        ["TerminalId", String(terminalId)],
    ];
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    const canonical = pairs.map(([k, v]) => `${k}=${v}`).join("&");
    const key = Buffer.from(secretKey.replace(/\s+/g, ""), "hex");
    const secureHash = crypto.createHmac("sha256", key).update(canonical, "utf8").digest("hex").toUpperCase();

    const endpoint = getCardPayEndpoint(env);
    let payskyResponse;
    try {
        payskyResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
            },
            body: JSON.stringify({
                MerchantId: merchantId,
                TerminalId: terminalId,
                MerchantReference: merchantReference,
                Amount: amountMinor,
                TrxDateTime: datetime,
                SecureHash: secureHash,
                Currency: currency,
                CardNumber: cardNumber,
                ExpiryMonth: expiryMonth,
                ExpiryYear: expiryYear,
                CVV: cvv,
                CardHolderName: cardHolderName,
                PaymentType: "card",
            }),
        });
    } catch (error) {
        return {
            success: false,
            responseCode: null,
            systemReference: null,
            merchantReference,
            message: `Gateway request failed: ${error.message}`,
            rawResponse: { endpoint, error: error.message },
        };
    }

    const payload = await parseGatewayResponseSafe(payskyResponse);
    return normalizeGatewayResult(payskyResponse, payload);
}

export async function processPayskyTokenPayment({ amount, token, merchantReference }) {
    const merchantId = process.env.PAYSKY_MERCHANT_ID?.trim();
    const terminalId = process.env.PAYSKY_TERMINAL_ID?.trim();
    const secretKey = process.env.PAYSKY_SECRET_KEY_HEX?.trim();
    const currency = process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC?.trim() || "818";
    const env = getPayskyEnv();

    if (!merchantId || !terminalId || !secretKey) {
        throw new Error("Paysky not configured");
    }

    const amountMinor = Math.round(amount * 100);
    const datetime = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);

    // Build secure hash
    const pairs = [
        ["Amount", String(amountMinor)],
        ["DateTimeLocalTrxn", String(datetime)],
        ["MerchantId", String(merchantId)],
        ["MerchantReference", String(merchantReference)],
        ["TerminalId", String(terminalId)],
    ];
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    const canonical = pairs.map(([k, v]) => `${k}=${v}`).join("&");
    const key = Buffer.from(secretKey.replace(/\s+/g, ""), "hex");
    const secureHash = crypto.createHmac("sha256", key).update(canonical, "utf8").digest("hex").toUpperCase();

    const endpoint = getTokenPayEndpoint(env);
    let payskyResponse;
    try {
        payskyResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
            },
            body: JSON.stringify({
                MerchantId: merchantId,
                TerminalId: terminalId,
                MerchantReference: merchantReference,
                Amount: amountMinor,
                TrxDateTime: datetime,
                SecureHash: secureHash,
                Currency: currency,
                Token: token,
                PaymentType: "card",
            }),
        });
    } catch (error) {
        return {
            success: false,
            responseCode: null,
            systemReference: null,
            merchantReference,
            message: `Gateway request failed: ${error.message}`,
            rawResponse: { endpoint, error: error.message },
        };
    }

    const payload = await parseGatewayResponseSafe(payskyResponse);
    return normalizeGatewayResult(payskyResponse, payload);
}
