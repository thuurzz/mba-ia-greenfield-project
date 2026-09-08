import { env } from "@/lib/env";
import { VideoCard } from "@/components/video/video-card";

interface Video {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  createdAt: string;
  channel: { id: string; name: string; nickname: string };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const cursor = params.cursor || "";
  let url = `${env.API_URL}/videos/search?q=${encodeURIComponent(query)}&limit=20`;
  if (cursor) url += `&cursor=${cursor}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const videos: Video[] = data.videos || [];

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-6">
        {query ? `Results for "${query}"` : "Recent Videos"}
      </h1>

      {videos.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {query ? `No videos found for "${query}".` : "No videos available."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map(v => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}

      {data.nextCursor && (
        <div className="mt-8 text-center">
          <a
            href={`/search?q=${encodeURIComponent(query)}&cursor=${data.nextCursor}`}
            className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-full"
          >
            Next Page
          </a>
        </div>
      )}
    </div>
  );
}