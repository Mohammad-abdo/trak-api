import { describe, it, expect } from "vitest";
import { classifyAuditRoute } from "../middleware/securityAuditMiddleware.js";

describe("classifyAuditRoute", () => {
    it("classifies demand map", () => {
        expect(classifyAuditRoute("GET", "/api/demand-map/zones")?.category).toBe("map");
    });

    it("classifies payments prefix", () => {
        expect(classifyAuditRoute("GET", "/api/payments")?.category).toBe("payment");
    });

    it("classifies scheduled ride as payment", () => {
        expect(classifyAuditRoute("POST", "/api/rides/schedule")?.category).toBe("payment");
    });

    it("classifies mobile submit-otp as otp", () => {
        expect(classifyAuditRoute("POST", "/apimobile/user/auth/submit-otp")?.category).toBe("otp");
    });

    it("returns null for unrelated paths", () => {
        expect(classifyAuditRoute("GET", "/api/health")).toBeNull();
    });
});
