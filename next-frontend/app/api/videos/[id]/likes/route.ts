import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const response = await fetch(`${env.API_URL}/videos/${id}/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = await response.json();
  return NextResponse.json(data);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  const url = `${env.API_URL}/videos/${id}/likes`;
  const response = await fetch(url, {
    headers: session.isLoggedIn ? { Authorization: `Bearer ${session.accessToken}` } : {},
  });
  const data = await response.json();
  return NextResponse.json(data);
}