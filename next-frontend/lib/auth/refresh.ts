import { env } from "@/lib/env";

import { destroySession, getSession, setSession } from "./session";

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const session = await getSession();

  const res = await fetch(`${env.API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });

  if (!res.ok) {
    await safeDestroySession();
    return false;
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  if (!data.access_token || !data.refresh_token) {
    await safeDestroySession();
    return false;
  }

  try {
    await setSession({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userId: session.userId,
      email: session.email,
      channelSlug: session.channelSlug,
    });
    return true;
  } catch {
    // Cookie modification is not allowed during RSC render (Next.js restriction).
    // Refresh itself succeeded — report failure so the caller redirects to login.
    return false;
  }
}

/**
 * destroySession throws when called during an RSC render (cookies read-only).
 * Swallow the error — the caller falls back to redirecting to /login.
 */
async function safeDestroySession(): Promise<void> {
  try {
    await destroySession();
  } catch {
    // read-only cookies during RSC render — ignore
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function withRefresh(
  fetcher: () => Promise<Response>
): Promise<Response> {
  const response = await fetcher();

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshOnce();

  if (!refreshed) {
    return new Response(
      JSON.stringify({
        statusCode: 401,
        error: "UNAUTHORIZED",
        message: "Session expired",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return fetcher();
}
