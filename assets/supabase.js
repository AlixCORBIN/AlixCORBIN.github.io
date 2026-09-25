/* ============================================
   SUPABASE — config + helpers partagés
   La clé "anon" est publique par conception : la sécurité repose sur
   le RLS et les fonctions SECURITY DEFINER côté base.
   ============================================ */
const SUPABASE_URL = 'https://njkbhgmwylletmdmsmyl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2JoZ213eWxsZXRtZG1zbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ2MzYsImV4cCI6MjA5MjQ1MDYzNn0.Vp6CfEi3dtUL1Z1h8kYkrCAXBMlBuSogocffaKE_9tw';

// Requête vers l'API REST (POST par défaut). `path` relatif à /rest/v1/
function sbFetch(path, options = {}) {
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: 'POST',
        ...options,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
}

// Appel d'une fonction RPC. Les erreurs réseau sont ignorées (tracking non bloquant).
function sbPost(rpc, body, options = {}) {
    return sbFetch(`rpc/${rpc}`, { body: JSON.stringify(body || {}), ...options }).catch(() => {});
}
