import { http, HttpResponse } from "msw";
import { env } from "@/lib/env";

export const handlers = [
  http.post(`${env.API_URL}/videos/:id/like`, () => {
    return HttpResponse.json({ liked: true, action: "created" });
  }),

  http.post(`${env.API_URL}/videos/:id/dislike`, () => {
    return HttpResponse.json({ liked: true, action: "created" });
  }),

  http.get(`${env.API_URL}/videos/:id/likes`, () => {
    return HttpResponse.json({ likesCount: 5, dislikesCount: 1, userReaction: null });
  }),

  http.get(`${env.API_URL}/videos/:id/comments`, () => {
    return HttpResponse.json({
      comments: [
        { id: 1, body: "Great video!", userId: "u1", createdAt: "2026-09-01T00:00:00Z", likesCount: 3, dislikesCount: 0, replies: [] },
      ],
      nextCursor: null,
    });
  }),

  http.post(`${env.API_URL}/videos/:id/comments`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 2, body: body.body, userId: "u1", createdAt: new Date().toISOString(), likesCount: 0, dislikesCount: 0 }, { status: 201 });
  }),

  http.post(`${env.API_URL}/channels/:channelId/subscribe`, () => {
    return HttpResponse.json({ subscribed: true });
  }),

  http.post(`${env.API_URL}/channels/:channelId/unsubscribe`, () => {
    return HttpResponse.json({ subscribed: false });
  }),

  http.get(`${env.API_URL}/channels/:channelId/subscribed`, () => {
    return HttpResponse.json({ isSubscribed: false });
  }),

  http.get(`${env.API_URL}/subscriptions`, () => {
    return HttpResponse.json({
      subscriptions: [
        { channel: { id: "ch-1", name: "Test Channel", nickname: "test-channel" } },
      ],
      nextCursor: null,
    });
  }),
];