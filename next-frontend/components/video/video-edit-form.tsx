"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Video {
  id: string;
  title: string | null;
  description: string | null;
  visibility: string;
  thumbnailUrl: string | null;
}

export function VideoEditForm({ video }: { video: Video }) {
  const router = useRouter();
  const [title, setTitle] = useState(video.title || "");
  const [description, setDescription] = useState(video.description || "");
  const [visibility, setVisibility] = useState(video.visibility);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, visibility }),
    });
    if (res.ok) {
      router.push("/dashboard");
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2"
          maxLength={255}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border rounded px-3 py-2"
          rows={4}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Visibility</label>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}