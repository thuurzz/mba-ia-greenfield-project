interface SuggestedVideo {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  channelId: string;
  duration?: number | null;
}

interface SuggestedVideosProps {
  videos: SuggestedVideo[];
}

export function SuggestedVideos({ videos }: SuggestedVideosProps) {
  if (!videos || videos.length === 0) {
    return <p className="text-sm text-muted-foreground">No suggestions</p>;
  }

  return (
    <div className="space-y-3">
      {videos.map((v) => (
        <a
          key={v.id}
          href={`/watch/${v.id}`}
          className="flex gap-2 group"
        >
          <div className="w-40 h-24 shrink-0 bg-muted rounded overflow-hidden">
            {v.thumbnailUrl ? (
              <img src={`/api/videos/${v.id}/thumbnail`} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No thumb</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium line-clamp-2 group-hover:text-primary">{v.title || "Untitled"}</p>
            <p className="text-xs text-muted-foreground mt-1">{v.viewCount} views</p>
          </div>
        </a>
      ))}
    </div>
  );
}