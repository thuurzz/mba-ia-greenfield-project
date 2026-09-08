import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";

export const handlers = [
  http.get(`${env.API_URL}/channels/:nickname`, ({ params }) => {
    const { nickname } = params;
    if (nickname === "nonexistent") {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      id: "ch-1",
      name: "Test Channel",
      nickname,
      description: "A test channel",
      subscriberCount: 0,
    });
  }),

  http.get(`${env.API_URL}/channels/:nickname/videos`, () => {
    return HttpResponse.json({
      videos: [
        { id: "v1", title: "Video 1", thumbnailUrl: null, viewCount: 10, createdAt: "2026-09-01T00:00:00Z" },
        { id: "v2", title: "Video 2", thumbnailUrl: null, viewCount: 20, createdAt: "2026-09-01T01:00:00Z" },
      ],
      nextCursor: null,
    });
  }),

  http.patch(`${env.API_URL}/channels/me`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: "ch-1",
      name: body.name || "Test Channel",
      nickname: body.nickname || "test-channel",
      description: body.description || null,
    });
  }),
];