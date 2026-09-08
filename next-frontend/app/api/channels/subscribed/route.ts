import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId") || "";
  const url = `${env.API_URL}/channels/${channelId}/subscribed`;
  const res = await fetch(url, {
    headers: session.isLoggedIn ? { Authorization: `Bearer ${session.accessToken}` } : {},
  });
  const data = await res.json();
  return NextResponse.json(data);
}