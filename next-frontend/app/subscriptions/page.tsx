import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { authedFetch } from "@/lib/api/authed-fetch";

interface Subscription {
  channel: { id: string; name: string; nickname: string };
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");

  const params = await searchParams;
  const cursor = params.cursor || "";
  const qs = `limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  const res = await authedFetch(`/subscriptions?${qs}`);
  if (res.status === 401) redirect("/login");
  const data = await res.json();
  const subs: Subscription[] = data.subscriptions || [];

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Subscriptions</h1>
      {subs.length === 0 ? (
        <p className="text-muted-foreground">You haven&apos;t subscribed to any channels yet.</p>
      ) : (
        <div className="space-y-3">
          {subs.map(s => (
            <a
              key={s.channel.id}
              href={`/c/${s.channel.nickname}`}
              className="block p-4 border rounded-lg hover:bg-muted/50"
            >
              <h2 className="font-medium">{s.channel.name}</h2>
              <p className="text-sm text-muted-foreground">@{s.channel.nickname}</p>
            </a>
          ))}
        </div>
      )}
      {data.nextCursor && (
        <a
          href={`/subscriptions?cursor=${encodeURIComponent(JSON.stringify(data.nextCursor))}`}
          className="mt-4 inline-block px-4 py-2 bg-primary text-primary-foreground rounded"
        >
          Next Page
        </a>
      )}
    </main>
  );
}