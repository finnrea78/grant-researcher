// Server-only auth helper for API routes.
// Returns the authenticated user + scoped Supabase client, or throws a 401 Response.
import { createSupabaseServer } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return { user, supabase };
}
