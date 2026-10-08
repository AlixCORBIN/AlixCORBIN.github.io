import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://njkbhgmwylletmdmsmyl.supabase.co";

const SUPABASE_KEY = "sb_publishable_VYQeM9TBjjoqs4CeAT06mQ_1AJ4uf7p";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
  },
});

export const SUPABASE_ANON_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2JoZ213eWxsZXRtZG1zbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ2MzYsImV4cCI6MjA5MjQ1MDYzNn0.Vp6CfEi3dtUL1Z1h8kYkrCAXBMlBuSogocffaKE_9tw";
