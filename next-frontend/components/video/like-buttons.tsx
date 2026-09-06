"use client";

import { useState, useEffect } from "react";

interface LikeButtonsProps {
  videoId: string;
  initialLikes?: number;
  initialDislikes?: number;
}

export function LikeButtons({ videoId, initialLikes = 0, initialDislikes = 0 }: LikeButtonsProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [userReaction, setUserReaction] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/videos/${videoId}/likes`)
      .then(r => r.json())
      .then(d => {
        setLikes(d.likesCount);
        setDislikes(d.dislikesCount);
        setUserReaction(d.userReaction);
      })
      .catch(() => {});
  }, [videoId]);

  const toggle = async (isLike: boolean) => {
    setLoading(true);
    try {
      const endpoint = isLike ? "like" : "dislike";
      const res = await fetch(`/api/videos/${videoId}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 401) {
        alert("Please log in to like videos");
        return;
      }
      const data = await res.json();
      if (data.action === "removed") {
        if (isLike) setLikes(l => l - 1);
        else setDislikes(l => l - 1);
        setUserReaction(null);
      } else {
        if (userReaction !== null) {
          if (isLike) { setLikes(l => l + 1); setDislikes(l => l - 1); }
          else { setDislikes(l => l + 1); setLikes(l => l - 1); }
        } else {
          if (isLike) setLikes(l => l + 1);
          else setDislikes(l => l + 1);
        }
        setUserReaction(isLike);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => toggle(true)}
        disabled={loading}
        className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${userReaction === true ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
      >
        👍 {likes}
      </button>
      <button
        onClick={() => toggle(false)}
        disabled={loading}
        className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${userReaction === false ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
      >
        👎 {dislikes}
      </button>
    </div>
  );
}