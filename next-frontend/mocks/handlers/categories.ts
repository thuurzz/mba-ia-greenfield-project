import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";

export const handlers = [
  http.get(`${env.API_URL}/categories`, () => {
    return HttpResponse.json([
      { id: 1, name: "Music", slug: "music", displayOrder: 1 },
      { id: 2, name: "Gaming", slug: "gaming", displayOrder: 2 },
      { id: 3, name: "Education", slug: "education", displayOrder: 3 },
    ]);
  }),
];