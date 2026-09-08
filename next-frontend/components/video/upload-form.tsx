"use client";

import { useState, useRef, useCallback } from "react";

interface UploadState {
  progress: number;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
  videoId?: string;
}

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadState>({ progress: 0, status: "idle" });
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const startUpload = useCallback(async () => {
    if (!file) return;

    try {
      const res = await fetch("/api/videos", { method: "POST" });
      if (!res.ok) {
        setUpload({ progress: 0, status: "error", error: "Failed to create upload" });
        return;
      }
      const { id } = await res.json();
      setUpload((prev) => ({ ...prev, videoId: id }));

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUpload((prev) => ({ ...prev, progress: pct, status: "uploading" }));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 201 || xhr.status === 200) {
          setUpload((prev) => ({ ...prev, progress: 100, status: "done" }));
        } else {
          setUpload({ progress: 0, status: "error", error: "Upload failed" });
        }
      };

      xhr.onerror = () => {
        setUpload({ progress: 0, status: "error", error: "Upload failed" });
      };

      xhr.open("POST", `/api/videos/${id}/upload`);
      xhr.send(formData);
    } catch (err) {
      setUpload({ progress: 0, status: "error", error: String(err) });
    }
  }, [file]);

  const resetUpload = useCallback(() => {
    setFile(null);
    setUpload({ progress: 0, status: "idle" });
    xhrRef.current = null;
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

      {upload.status === "uploading" && (
        <div className="space-y-2">
          <div className="w-full bg-muted rounded-full h-4">
            <div
              className="bg-primary h-4 rounded-full transition-all"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{upload.progress}% uploaded</p>
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