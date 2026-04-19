/**
 * Build possible contactNumber strings for DB lookup — registration often stores local
 * format (010…) while login may send E.164 (+20…), so exact match fails with 401.
 *
 * @param {unknown} input - phone from request body
 * @returns {string[]} distinct non-empty variants to use in { in: variants }
 */
export function contactNumberLookupVariants(input) {
    if (input == null || input === "") return [];
    const trimmed = String(input).trim();
    const set = new Set([trimmed]);
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return [...set];

    set.add(digits);

    // Egypt (+20): DB often has 01XXXXXXXXX; app may send +201XXXXXXXXX
    if (digits.startsWith("20") && digits.length >= 12) {
        const rest = digits.slice(2);
        set.add(rest);
        set.add("0" + rest);
        set.add("+20" + rest);
    }
    if (digits.startsWith("0") && digits.length >= 10) {
        set.add("20" + digits.slice(1));
        set.add("+20" + digits.slice(1));
        // Some rows store national digits without leading 0 (e.g. 1000000002)
        set.add(digits.slice(1));
    }
    // Match 10XXXXXXXXX → 0XXXXXXXXXX
    if (!digits.startsWith("0") && digits.length === 10 && digits.startsWith("1")) {
        set.add("0" + digits);
    }

    return [...set].filter(Boolean);
}

/**
 * Mobile rider/driver login accepts only the registered phone (`phone` body field) + `password`.
 * Rejects mistaken email-based login attempts so clients do not use the web dashboard pattern.
 *
 * @param {{ phone?: unknown, email?: unknown }} body - raw request body
 * @returns {{ status: number, message: string } | null} HTTP error to return, or null if policy passes
 */
export function mobileLoginPhoneOnlyPolicyError(body) {
    const phoneRaw = body?.phone;
    const emailRaw = body?.email;
    const phone = typeof phoneRaw === "string" ? phoneRaw.trim() : "";
    const email = typeof emailRaw === "string" ? emailRaw.trim() : "";

    if (email && !phone) {
        return {
            status: 400,
            message:
                "Mobile login requires your phone number and password. Email cannot be used to sign in.",
        };
    }
    if (phone.includes("@")) {
        return {
            status: 400,
            message: "Use your phone number to sign in, not your email address.",
        };
    }
    return null;
}
