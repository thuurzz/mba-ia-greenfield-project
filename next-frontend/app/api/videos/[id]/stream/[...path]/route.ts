import { env } from "@/lib/env";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const { id, path } = await params;
  const filePath = path.join("/");
  const upstream = `${env.API_URL}/videos/${id}/stream/${filePath}`;

  const response = await fetch(upstream);

  if (!response.ok || !response.body) {
    return new Response("Stream file not found", { status: 404 });
  }

  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=3600");

  return new Response(response.body, { status: 200, headers });
}