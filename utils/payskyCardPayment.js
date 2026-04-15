import prisma from "../utils/prisma.js";
import crypto from "crypto";
import { getPayskyEnv } from "./payskyApi.js";

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

    // Call Paysky API to process card payment
    const payskyResponse = await fetch(`${env.API_BASE}/api/v1/payments/pay`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
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

    const result = await payskyResponse.json();

    return {
        success: result.ResponseCode === "0000" || result.Status === "SUCCESS",
        responseCode: result.ResponseCode,
        systemReference: result.SystemReference,
        merchantReference: result.MerchantReference,
        message: result.ResponseMessage || result.Message,
        rawResponse: result,
    };
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

    // Call Paysky Token Payment API
    const payskyResponse = await fetch(`${env.API_BASE}/api/v1/payments/token-pay`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
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

    const result = await payskyResponse.json();

    return {
        success: result.ResponseCode === "0000" || result.Status === "SUCCESS",
        responseCode: result.ResponseCode,
        systemReference: result.SystemReference,
        merchantReference: result.MerchantReference,
        message: result.ResponseMessage || result.Message,
        rawResponse: result,
    };
}
