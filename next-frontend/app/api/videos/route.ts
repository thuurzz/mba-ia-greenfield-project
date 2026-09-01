import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

interface CreateVideoResponse {
  id: string;
  uploadUrl: string;
}

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Not authenticated" }, { status: 401 });
  }

  const response = await fetch(`${env.API_URL}/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Upload creation failed" }));
    return NextResponse.json(error, { status: response.status });
  }

  const data = (await response.json()) as CreateVideoResponse;
  return NextResponse.json(data, { status: 201 });
}