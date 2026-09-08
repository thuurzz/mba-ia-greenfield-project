"use client";

import { useState } from "react";

interface DescriptionExpandProps {
  description: string | null;
}

export function DescriptionExpand({ description }: DescriptionExpandProps) {
  const [expanded, setExpanded] = useState(false);

  if (!description) return null;

  const isLong = description.length > 200;
  const displayText = expanded || !isLong ? description : description.slice(0, 200) + "...";

  return (
    <div className="mt-3 p-3 bg-muted rounded-lg">
      <p className="text-sm whitespace-pre-wrap">{displayText}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-sm text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}