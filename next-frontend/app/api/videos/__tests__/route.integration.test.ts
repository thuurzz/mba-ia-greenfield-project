import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";

const cookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) =>
      cookieMap.has(name) ? { name, value: cookieMap.get(name)! } : undefined,
    set: (name: string, value: string) => { cookieMap.set(name, value); },
    delete: (name: string) => { cookieMap.delete(name); },
  }),
}));

let POST: () => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import("@/app/api/videos/route"));
});

const { setSession, getSession } = await import("@/lib/auth/session");

beforeEach(async () => {
  cookieMap.clear();
  await setSession({
    accessToken: "active-at",
    refreshToken: "active-rt",
    userId: "u1",
    email: "alice@example.com",
    channelSlug: "alice",
  });
});

describe("POST /api/videos", () => {
  it("returns 201 with video id and upload url on success", async () => {
    const res = await POST();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("uploadUrl");
    expect(typeof body.id).toBe("string");
  });

  it("returns 401 when not authenticated", async () => {
    cookieMap.clear();
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("forwards upstream error", async () => {
    server.use(
      http.post(`${env.API_URL}/videos`, () =>
        HttpResponse.json({ error: "UPSTREAM_ERROR", message: "Failed" }, { status: 500 })
      )
    );
    const res = await POST();
    expect(res.status).toBe(500);
  });
});