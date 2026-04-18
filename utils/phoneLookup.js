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
    }

    return [...set].filter(Boolean);
}
