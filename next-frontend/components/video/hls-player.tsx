"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface HlsPlayerProps {
  src: string;
  poster?: string;
  autoplay?: boolean;
}

export function HlsPlayer({ src, poster, autoplay }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError("Failed to load video");
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      setError("HLS is not supported in this browser");
      return;
    }

    return () => {
      hls?.destroy();
    };
  }, [src]);

  return (
    <div className="relative">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
          <p className="text-destructive">{error}</p>
        </div>
      )}
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoplay}
        controls
        className="w-full max-w-4xl"
        playsInline
      />
    </div>
  );
}