import { createClient } from '@supabase/supabase-js'

export const supabase = createClient('https://njkbhgmwylletmdmsmyl.supabase.co', 'sb_publishable_VYQeM9TBjjoqs4CeAT06mQ_1AJ4uf7p', {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 30 } },
})
