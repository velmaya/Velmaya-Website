import { createClient } from "@supabase/supabase-js";

// Browser-safe client — uses the anon key, respects RLS.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
