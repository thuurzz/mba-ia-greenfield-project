import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") || "";
  const limit = searchParams.get("limit") || "20";
  const url = `${env.API_URL}/videos/${id}/comments?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  const response = await fetch(url);
  const data = await response.json();
  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await request.json();
  const response = await fetch(`${env.API_URL}/videos/${id}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}