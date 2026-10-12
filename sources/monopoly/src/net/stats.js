// Envoi des stats de fin de partie vers Supabase (même projet que le Casino).
// Appel REST direct : pas besoin d'embarquer supabase-js pour un seul RPC.
const SUPABASE_URL = 'https://njkbhgmwylletmdmsmyl.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VYQeM9TBjjoqs4CeAT06mQ_1AJ4uf7p'

export async function saveMonopolyGame(g) {
  if (!g?.id || g.phase !== 'over') return
  const winner = g.players.find((p) => p.id === g.winner)
  const body = {
    p_id: g.id,
    p_players: g.players.length,
    p_bots: g.players.filter((p) => p.isBot).length,
    p_rounds: g.round || 0,
    p_duration: Math.round((Date.now() - (g.startedAt || Date.now())) / 1000),
    p_winner: winner?.name || null,
    p_winner_is_bot: !!winner?.isBot,
    p_props: g.stats?.buys || 0,
    p_hotels: g.stats?.hotels || 0,
    p_trades: g.stats?.trades || 0,
    p_bankrupt: g.stats?.bankruptcies || 0,
    p_reason: g.endReason || null,
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_monopoly_game`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) console.warn('saveMonopolyGame', r.status)
  } catch (e) {
    console.warn('saveMonopolyGame', e.message)
  }
}
