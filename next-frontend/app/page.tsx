import { env } from "@/lib/env";
import { VideoCard } from "@/components/video/video-card";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Video {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  createdAt: string;
  channel: { id: string; name: string; nickname: string };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const categoryId = params.categoryId || "";
  const cursor = params.cursor || "";
  let url = `${env.API_URL}/videos/home?limit=20`;
  if (cursor) url += `&cursor=${cursor}`;
  if (categoryId) url += `&categoryId=${categoryId}`;

  const [homeRes, catRes] = await Promise.all([
    fetch(url, { cache: "no-store" }),
    fetch(`${env.API_URL}/categories`, { cache: "no-store" }),
  ]);

  const homeData = await homeRes.json();
  const categories: Category[] = await catRes.json();
  const videos: Video[] = homeData.videos || [];

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <a
          href="/"
          className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${!categoryId ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          All
        </a>
        {categories.map(c => (
          <a
            key={c.id}
            href={`/?categoryId=${c.id}`}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${categoryId === String(c.id) ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            {c.name}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {videos.map(v => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>

      {videos.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No videos yet.</p>
      )}

      {homeData.nextCursor && (
        <div className="mt-8 text-center">
          <a
            href={`/?cursor=${homeData.nextCursor}${categoryId ? `&categoryId=${categoryId}` : ""}`}
            className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-full"
          >
            Next Page
          </a>
        </div>
      )}
    </div>
  );
}