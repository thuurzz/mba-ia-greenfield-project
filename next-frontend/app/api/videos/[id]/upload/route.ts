import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`${env.API_URL}/videos/${id}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}