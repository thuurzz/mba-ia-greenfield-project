import "server-only";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { withRefresh } from "@/lib/auth/refresh";

/**
 * Server-side fetch wrapper with transparent token refresh.
 * RSC pages call this instead of raw fetch when hitting the upstream API
 * with the session's access token. On 401, refreshes once (single-flight)
 * and retries.
 */
export async function authedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const session = await getSession();

  return withRefresh(() =>
    fetch(`${env.API_URL}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    })
  );
}