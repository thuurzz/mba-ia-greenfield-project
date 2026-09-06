"use client";

import { useState, useEffect } from "react";

interface SubscribeButtonProps {
  channelId: string;
  initialSubscriberCount?: number;
}

export function SubscribeButton({ channelId, initialSubscriberCount = 0 }: SubscribeButtonProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [count, setCount] = useState(initialSubscriberCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/channels/${channelId}/subscribe`)
      .then(r => r.json())
      .then(d => {
        setSubscribed(d.isSubscribed);
      })
      .catch(() => {});
  }, [channelId]);

  const toggle = async () => {
    setLoading(true);
    try {
      const endpoint = subscribed ? "unsubscribe" : "subscribe";
      const res = await fetch(`/api/channels/${channelId}/${endpoint}`, {
        method: "POST",
      });
      if (res.status === 401) {
        alert("Please log in to subscribe");
        return;
      }
      if (res.ok) {
        setSubscribed(!subscribed);
        setCount(c => subscribed ? c - 1 : c + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={loading}
        className={`px-4 py-2 rounded-full text-sm font-medium ${subscribed ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}
      >
        {subscribed ? "Subscribed" : "Subscribe"}
      </button>
      <span className="text-sm text-muted-foreground">{count} subscribers</span>
    </div>
  );
}