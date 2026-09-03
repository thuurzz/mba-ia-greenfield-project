import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

interface Video {
  id: string;
  title: string | null;
  status: string;
  visibility: string;
  viewCount: number;
  createdAt: string;
  thumbnailUrl: string | null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");

  const params = await searchParams;
  const status = params.status || "";
  const cursor = params.cursor || "";
  const url = `${env.API_URL}/videos?limit=20${status ? `&status=${status}` : ""}${cursor ? `&cursor=${cursor}` : ""}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const data = await response.json();
  const videos: Video[] = data.videos || [];

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Channel Dashboard</h1>
      <div className="mb-4">
        <a href="/dashboard" className="px-3 py-1 bg-primary text-primary-foreground rounded mr-2">All</a>
        <a href="/dashboard?status=draft" className="px-3 py-1 bg-muted rounded mr-2">Drafts</a>
        <a href="/dashboard?status=ready" className="px-3 py-1 bg-muted rounded mr-2">Published</a>
        <a href="/dashboard?status=failed" className="px-3 py-1 bg-muted rounded">Failed</a>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Thumbnail</th>
            <th className="text-left p-2">Title</th>
            <th className="text-left p-2">Views</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v) => (
            <tr key={v.id} className="border-b hover:bg-muted/50">
              <td className="p-2">
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt="" className="w-20 h-12 object-cover rounded" />
                ) : (
                  <div className="w-20 h-12 bg-muted rounded" />
                )}
              </td>
              <td className="p-2">{v.title || "Untitled"}</td>
              <td className="p-2">{v.viewCount}</td>
              <td className="p-2">{v.status}</td>
              <td className="p-2">
                <a href={`/dashboard/videos/${v.id}/edit`} className="text-primary hover:underline">
                  Edit
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.nextCursor && (
        <a
          href={`/dashboard?cursor=${data.nextCursor}${status ? `&status=${status}` : ""}`}
          className="mt-4 inline-block px-4 py-2 bg-primary text-primary-foreground rounded"
        >
          Next Page
        </a>
      )}
    </main>
  );
}