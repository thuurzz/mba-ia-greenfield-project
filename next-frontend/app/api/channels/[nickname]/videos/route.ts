import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ nickname: string }> }
) {
  const { nickname } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") || "";
  const limit = searchParams.get("limit") || "12";
  const response = await fetch(`${env.API_URL}/videos/channel/${nickname}?cursor=${cursor}&limit=${limit}`);
  if (!response.ok) {
    return NextResponse.json({ error: "CHANNEL_NOT_FOUND" }, { status: 404 });
  }
  const data = await response.json();
  return NextResponse.json(data);
}