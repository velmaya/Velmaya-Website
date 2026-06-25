import { createClient } from "@supabase/supabase-js";

// Server-only client — uses the service role key, bypasses RLS.
// Never import this from a "use client" component or expose the key to the browser.
// At launch (no auth/RLS yet) all writes go through this client from server
// routes/actions only — see docs/03-database-schema.sql notes.
export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
