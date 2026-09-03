import { env } from "@/lib/env";
import { HlsPlayer } from "@/components/video/hls-player";
import { VideoInfo } from "@/components/video/video-info";
import { DescriptionExpand } from "@/components/video/description-expand";
import { SuggestedVideos } from "@/components/video/suggested-videos";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Video {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  visibility: string;
  viewCount: number;
  channelId: string;
  hlsPlaylistUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  createdAt: string;
  originalFileName: string | null;
}

export default async function WatchPage({ params }: PageProps) {
  const { id } = await params;
  const videoRes = await fetch(`${env.API_URL}/videos/${id}`, { cache: "no-store" });
  if (!videoRes.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-muted-foreground">Video not found</p>
      </main>
    );
  }
  const video: Video = await videoRes.json();

  const suggestedRes = await fetch(`${env.API_URL}/videos/${id}/suggested`, { cache: "no-store" });
  const suggested = await suggestedRes.json();

  const streamUrl = `${env.API_URL}/videos/${id}/stream/playlist.m3u8`;

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <HlsPlayer src={streamUrl} poster={video.thumbnailUrl || undefined} />
          </div>
          <div className="mt-4">
            <h1 className="text-xl font-bold">{video.title || "Untitled"}</h1>
            <VideoInfo
              viewCount={video.viewCount}
              createdAt={video.createdAt}
              duration={video.duration}
              channelId={video.channelId}
              videoId={video.id}
              filename={video.originalFileName || undefined}
            />
            <DescriptionExpand description={video.description} />
          </div>
        </div>
        <aside className="w-full lg:w-80 shrink-0">
          <h2 className="text-lg font-semibold mb-3">Suggested</h2>
          <SuggestedVideos videos={suggested} />
        </aside>
      </div>
    </main>
  );
}