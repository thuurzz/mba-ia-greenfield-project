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
];