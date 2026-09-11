import { env } from "@/lib/env";

interface PageProps {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

interface Channel {
  id: string;
  name: string;
  nickname: string;
  description: string | null;
}

interface Video {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  createdAt: string;
}

export default async function ChannelPage({ params, searchParams }: PageProps) {
  const { nickname } = await params;
  const { cursor } = await searchParams;

  const channelRes = await fetch(`${env.API_URL}/channels/${nickname}`, { cache: "no-store" });
  if (!channelRes.ok) return <div className="p-8 text-center">Channel not found</div>;
  const channel: Channel = await channelRes.json();

  const url = `${env.API_URL}/videos/channel/${nickname}?limit=12${cursor ? `&cursor=${cursor}` : ""}`;
  const videosRes = await fetch(url, { cache: "no-store" });
  const videosData = await videosRes.json();
  const videos: Video[] = videosData.videos || [];

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{channel.name}</h1>
        <p className="text-muted-foreground">@{channel.nickname}</p>
        {channel.description && <p className="mt-2">{channel.description}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {videos.map((v) => (
          <a key={v.id} href={`/watch/${v.id}`} className="group">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              {v.thumbnailUrl ? (
                <img src={`/api/videos/${v.id}/thumbnail`} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">No thumbnail</div>
              )}
            </div>
            <h3 className="mt-2 font-medium group-hover:text-primary">{v.title || "Untitled"}</h3>
            <p className="text-sm text-muted-foreground">{v.viewCount} views</p>
          </a>
        ))}
      </div>

      {videosData.nextCursor && (
        <a
          href={`/c/${nickname}?cursor=${videosData.nextCursor}`}
          className="mt-6 inline-block px-4 py-2 bg-primary text-primary-foreground rounded"
        >
          Load More
        </a>
      )}
    </main>
  );
}