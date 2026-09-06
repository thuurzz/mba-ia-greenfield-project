"use client";

import { useState } from "react";
import { CommentForm } from "./comment-form";

interface Comment {
  id: number;
  body: string;
  userId: string;
  createdAt: string;
  likesCount: number;
  dislikesCount: number;
  replies?: Comment[];
}

interface CommentSectionProps {
  videoId: string;
}

export function CommentSection({ videoId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadComments = async () => {
    setLoading(true);
    try {
      const url = `/api/videos/${videoId}/comments?limit=20${cursor ? `&cursor=${encodeURIComponent(JSON.stringify(cursor))}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setComments(prev => [...prev, ...(data.comments || [])]);
      setCursor(data.nextCursor);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    loadComments();
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4">Comments</h3>
      <CommentForm videoId={videoId} onCreated={() => { setComments([]); setCursor(null); setLoaded(false); }} />
      <div className="mt-4 space-y-4">
        {comments.map(c => (
          <div key={c.id} className="border-b pb-3">
            <p className="text-sm">{c.body}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{c.likesCount} likes</span>
              <CommentForm videoId={videoId} parentId={c.id} onCreated={() => { setComments([]); setCursor(null); setLoaded(false); }} compact />
            </div>
            {c.replies?.map(r => (
              <div key={r.id} className="ml-6 mt-2 pl-3 border-l">
                <p className="text-sm">{r.body}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.likesCount} likes</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      {cursor && (
        <button
          onClick={loadComments}
          disabled={loading}
          className="mt-4 text-sm text-primary hover:underline"
        >
          {loading ? "Loading..." : "Load More Comments"}
        </button>
      )}
    </div>
  );
}