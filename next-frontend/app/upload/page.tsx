import { UploadForm } from "@/components/video/upload-form";

export default function UploadPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Upload Video</h1>
      <UploadForm />
    </main>
  );
}