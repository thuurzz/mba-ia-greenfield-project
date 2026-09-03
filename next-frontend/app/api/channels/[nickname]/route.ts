import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export async function GET(
  request: Request,
  { params }: { params: { nickname: string } }
) {
  const response = await fetch(`${env.API_URL}/channels/${params.nickname}`);
  if (!response.ok) {
    return NextResponse.json({ error: "CHANNEL_NOT_FOUND" }, { status: 404 });
  }
  const data = await response.json();
  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: { nickname: string } }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await request.json();
  const response = await fetch(`${env.API_URL}/channels/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}