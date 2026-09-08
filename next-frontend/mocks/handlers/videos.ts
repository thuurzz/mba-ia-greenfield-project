import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";

export const handlers = [
  http.post(`${env.API_URL}/videos`, () => {
    return HttpResponse.json(
      { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", uploadUrl: "/api/videos/upload/01ARZ3NDEKTSV4RRFFQ69G5FAV" },
      { status: 201 }
    );
  }),

  http.get(`${env.API_URL}/videos/:id`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id,
      title: null,
      status: "draft",
      visibility: "public",
      viewCount: 0,
    });
  }),

  http.patch(`${env.API_URL}/videos/:id`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id,
      title: body.title || null,
      description: body.description || null,
      visibility: body.visibility || "public",
      status: "ready",
    });
  }),

  http.get(`${env.API_URL}/videos`, () => {
    return HttpResponse.json({
      videos: [
        { id: "vid-1", title: "Test Video", status: "ready", visibility: "public", viewCount: 42, createdAt: "2026-09-01T00:00:00Z" },
      ],
      nextCursor: null,
    });
  }),

  http.post(`${env.API_URL}/videos/:id/view`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.get(`${env.API_URL}/videos/:id/suggested`, () => {
    return HttpResponse.json([
      { id: "sug-1", title: "Suggested 1", thumbnailUrl: null, viewCount: 10 },
      { id: "sug-2", title: "Suggested 2", thumbnailUrl: null, viewCount: 20 },
    ]);
  }),

  http.get(`${env.API_URL}/videos/home`, () => {
    return HttpResponse.json({
      videos: [
        { id: "home-1", title: "Home Video 1", thumbnailUrl: null, viewCount: 100, createdAt: "2026-09-01T00:00:00Z", channel: { id: "ch-1", name: "Test Channel", nickname: "test" } },
        { id: "home-2", title: "Home Video 2", thumbnailUrl: null, viewCount: 50, createdAt: "2026-09-01T01:00:00Z", channel: { id: "ch-1", name: "Test Channel", nickname: "test" } },
      ],
      nextCursor: null,
    });
  }),

  http.get(`${env.API_URL}/videos/search`, () => {
    return HttpResponse.json({
      videos: [
        { id: "search-1", title: "Search Result 1", thumbnailUrl: null, viewCount: 10, createdAt: "2026-09-01T00:00:00Z", channel: { id: "ch-1", name: "Test Channel", nickname: "test" } },
      ],
      nextCursor: null,
    });
  }),

  http.get(`${env.API_URL}/videos/channel/:nickname`, () => {
    return HttpResponse.json({
      videos: [
        { id: "v1", title: "Channel Video 1", thumbnailUrl: null, viewCount: 10, createdAt: "2026-09-01T00:00:00Z" },
      ],
      nextCursor: null,
    });
  }),
];