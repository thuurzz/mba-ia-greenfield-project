import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export async function POST(
  _request: Request,
  { params }: { params: { channelId: string } }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const response = await fetch(`${env.API_URL}/channels/${params.channelId}/subscribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}