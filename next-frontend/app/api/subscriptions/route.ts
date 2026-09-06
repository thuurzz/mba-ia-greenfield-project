import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ subscriptions: [], nextCursor: null });
  }
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") || "";
  const limit = searchParams.get("limit") || "20";
  const url = `${env.API_URL}/subscriptions?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = await response.json();
  return NextResponse.json(data);
}