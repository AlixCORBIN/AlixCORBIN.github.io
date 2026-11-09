import { createClient } from '@supabase/supabase-js'

// Clé publique (rôle anon) : l'accès est encadré par les règles RLS côté base
export const SUPABASE_URL = 'https://api.alixcorbin.com'
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2JoZ213eWxsZXRtZG1zbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ2MzYsImV4cCI6MjA5MjQ1MDYzNn0.Vp6CfEi3dtUL1Z1h8kYkrCAXBMlBuSogocffaKE_9tw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  // client sans session : le lien email est lu par le client de compte (mii/lib/account.js)
  auth: { persistSession: false, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 30 } },
})
