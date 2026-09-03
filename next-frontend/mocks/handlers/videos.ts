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
];