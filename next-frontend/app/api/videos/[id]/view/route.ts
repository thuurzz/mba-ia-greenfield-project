import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const response = await fetch(`${env.API_URL}/videos/${id}/view`, { method: "POST" });
  const data = await response.json();
  return NextResponse.json(data);
}