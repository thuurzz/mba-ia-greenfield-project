import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") || "";
  const cursor = searchParams.get("cursor") || "";
  const limit = searchParams.get("limit") || "20";
  let url = `${env.API_URL}/videos/home?limit=${limit}`;
  if (cursor) url += `&cursor=${cursor}`;
  if (categoryId) url += `&categoryId=${categoryId}`;
  const response = await fetch(url);
  const data = await response.json();
  return NextResponse.json(data);
}