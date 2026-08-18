import { describe, expect, it } from "vitest";

import { withSecurityHeaders } from "./security-headers";

describe("withSecurityHeaders", () => {
  it("preserva a resposta e adiciona os cabeçalhos esperados", async () => {
    const response = withSecurityHeaders(
      new Response("ok", {
        status: 201,
        headers: { "x-request-id": "request-1" },
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("x-request-id")).toBe("request-1");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("permissions-policy")).toContain("geolocation=(self)");
  });
});
