import { env } from "@/lib/env";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const response = await fetch(`${env.API_URL}/videos/${id}/thumbnail`);

  if (!response.ok || !response.body) {
    return new Response("Thumbnail not found", { status: 404 });
  }

  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=3600");

  return new Response(response.body, { status: 200, headers });
}