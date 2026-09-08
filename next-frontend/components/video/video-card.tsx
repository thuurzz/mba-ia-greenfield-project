interface VideoCardProps {
  video: {
    id: string;
    title: string | null;
    thumbnailUrl: string | null;
    viewCount: number;
    createdAt: string;
    channel: { id: string; name: string; nickname: string };
  };
}

export function VideoCard({ video }: VideoCardProps) {
  const date = new Date(video.createdAt).toISOString().slice(0, 10);

  return (
    <a href={`/watch/${video.id}`} className="group">
      <div className="aspect-video bg-muted rounded-lg overflow-hidden">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No thumbnail
          </div>
        )}
      </div>
      <h3 className="mt-2 font-medium text-sm line-clamp-2 group-hover:text-primary">
        {video.title || "Untitled"}
      </h3>
      <p className="text-xs text-muted-foreground mt-1">{video.channel?.name || "Unknown"}</p>
      <p className="text-xs text-muted-foreground">
        {video.viewCount} views · {date}
      </p>
    </a>
  );
}