"use client";

interface VideoInfoProps {
  viewCount: number;
  createdAt: string;
  duration: number | null;
  channelId: string;
  videoId: string;
  filename?: string;
}

export function VideoInfo({ viewCount, createdAt, duration, videoId, filename }: VideoInfoProps) {
  const date = new Date(createdAt).toISOString().slice(0, 10);
  const durationStr = duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}` : null;

  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
      <span>{viewCount} views</span>
      <span>{date}</span>
      {durationStr && <span>{durationStr}</span>}
      <a
        href={`/api/videos/${videoId}/download`}
        className="ml-auto px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
      >
        Download
      </a>
    </div>
  );
}