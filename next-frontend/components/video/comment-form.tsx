"use client";

import { useState } from "react";

interface CommentFormProps {
  videoId: string;
  parentId?: number;
  onCreated: () => void;
  compact?: boolean;
}

export function CommentForm({ videoId, parentId, onCreated, compact }: CommentFormProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), parentId }),
      });
      if (res.status === 401) {
        alert("Please log in to comment");
        return;
      }
      if (res.ok) {
        setBody("");
        onCreated();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={() => {
          const b = prompt("Reply:");
          if (b) {
            setBody(b);
            submit();
          }
        }}
        className="text-xs text-primary hover:underline"
      >
        Reply
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Add a comment..."
        className="flex-1 border rounded px-3 py-2 text-sm"
        onKeyDown={e => e.key === "Enter" && submit()}
      />
      <button
        onClick={submit}
        disabled={submitting || !body.trim()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
      >
        {submitting ? "..." : "Comment"}
      </button>
    </div>
  );
}