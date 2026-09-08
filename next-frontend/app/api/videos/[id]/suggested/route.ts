import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const response = await fetch(`${env.API_URL}/videos/${id}/suggested`);
  if (!response.ok) {
    return NextResponse.json([], { status: 200 });
  }
  const data = await response.json();
  return NextResponse.json(data);
}