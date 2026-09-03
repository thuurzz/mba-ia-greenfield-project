import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  const response = await fetch(`${env.API_URL}/categories`);
  const data = await response.json();
  return NextResponse.json(data);
}