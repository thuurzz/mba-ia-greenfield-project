"use client";

import { useState, useRef, useCallback } from "react";
import * as tus from "tus-js-client";

interface UploadState {
  progress: number;
  status: "idle" | "uploading" | "paused" | "done" | "error";
  error?: string;
  videoId?: string;
}

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadState>({ progress: 0, status: "idle" });
  const uploadRef = useRef<tus.Upload | null>(null);

  const startUpload = useCallback(async () => {
    if (!file) return;

    try {
      const res = await fetch("/api/videos", { method: "POST" });
      if (!res.ok) {
        setUpload({ progress: 0, status: "error", error: "Failed to create upload" });
        return;
      }
      const { id, uploadUrl } = await res.json();
      setUpload((prev) => ({ ...prev, videoId: id }));

      const tusUpload = new tus.Upload(file, {
        endpoint: uploadUrl,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 5 * 1024 * 1024,
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onError: (err) => {
          setUpload({ progress: 0, status: "error", error: err.message });
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = Math.round((bytesUploaded / bytesTotal) * 100);
          setUpload((prev) => ({ ...prev, progress, status: "uploading" }));
        },
        onSuccess: () => {
          setUpload((prev) => ({ ...prev, progress: 100, status: "done" }));
        },
      });

      uploadRef.current = tusUpload;
      tusUpload.start();
    } catch (err) {
      setUpload({ progress: 0, status: "error", error: String(err) });
    }
  }, [file]);

  const pauseUpload = useCallback(() => {
    uploadRef.current?.abort();
    setUpload((prev) => ({ ...prev, status: "paused" }));
  }, []);

  const resumeUpload = useCallback(() => {
    uploadRef.current?.start();
    setUpload((prev) => ({ ...prev, status: "uploading" }));
  }, []);

  const resetUpload = useCallback(() => {
    setFile(null);
    setUpload({ progress: 0, status: "idle" });
    uploadRef.current = null;
  }, []);

  return (
    <div className="max-w-md space-y-4">
      {upload.status === "idle" && (
        <div>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
          {file && (
            <button
              onClick={startUpload}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Upload {file.name}
            </button>
          )}
        </div>
      )}

      {(upload.status === "uploading" || upload.status === "paused") && (
        <div className="space-y-2">
          <div className="w-full bg-muted rounded-full h-4">
            <div
              className="bg-primary h-4 rounded-full transition-all"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{upload.progress}% uploaded</p>
          {upload.status === "uploading" ? (
            <button onClick={pauseUpload} className="px-4 py-2 bg-secondary text-secondary-foreground rounded">
              Pause
            </button>
          ) : (
            <button onClick={resumeUpload} className="px-4 py-2 bg-primary text-primary-foreground rounded">
              Resume
            </button>
          )}
        </div>
      )}

      {upload.status === "done" && (
        <div className="space-y-2">
          <p className="text-green-600 font-medium">Upload complete!</p>
          <p className="text-sm text-muted-foreground">Video ID: {upload.videoId}</p>
          <button onClick={resetUpload} className="px-4 py-2 bg-primary text-primary-foreground rounded">
            Upload another
          </button>
        </div>
      )}

      {upload.status === "error" && (
        <div className="space-y-2">
          <p className="text-red-600 font-medium">Upload failed: {upload.error}</p>
          <button onClick={resetUpload} className="px-4 py-2 bg-primary text-primary-foreground rounded">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}