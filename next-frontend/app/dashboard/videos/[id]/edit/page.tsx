import { env } from "@/lib/env";
import { VideoEditForm } from "@/components/video/video-edit-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoEditPage({ params }: PageProps) {
  const { id } = await params;
  const response = await fetch(`${env.API_URL}/videos/${id}`, { cache: "no-store" });
  if (!response.ok) return <div className="p-8">Video not found</div>;
  const video = await response.json();

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Video</h1>
      <VideoEditForm video={video} />
    </main>
  );
}