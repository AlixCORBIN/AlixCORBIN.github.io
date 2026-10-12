// Fin de partie : le résultat est confirmé par chaque joueur humain auprès du serveur
// (RPC report_game, même projet Supabase que le Casino). La partie n'est enregistrée que
// si tous les humains envoient le même résultat ; le classement ne compte que les parties
// entre au moins deux humains, et le pseudo affiché est celui réservé par le compte.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://njkbhgmwylletmdmsmyl.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VYQeM9TBjjoqs4CeAT06mQ_1AJ4uf7p'
// même stockage que la session du portfolio / du Casino (compte ou identité anonyme)
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'portfolio-auth' } })

let pending = null
export async function myUid() {
  try {
    let { data } = await sb.auth.getSession()
    if (!data.session) {
      pending ||= sb.auth.signInAnonymously().finally(() => { pending = null })
      await pending
      ;({ data } = await sb.auth.getSession())
    }
    return data.session?.user?.id || null
  } catch { return null }
}

// Construit le rapport (côté hôte) à partir de l'état final et des identités des joueurs
export function buildMonopolyReport(g, uidOf) {
  if (!g?.id || g.phase !== 'over') return null
  const winner = g.players.find((p) => p.id === g.winner)
  const humans = g.players.filter((p) => !p.isBot)
  const uids = humans.map((p) => uidOf(p.id)).filter(Boolean)
  const args = {
    p_id: g.id,
    p_players: g.players.length,
    p_bots: g.players.length - humans.length,
    p_rounds: g.round || 0,
    p_duration: Math.round((Date.now() - (g.startedAt || Date.now())) / 1000),
    p_winner: null,
    p_winner_is_bot: !!winner?.isBot,
    p_props: g.stats?.buys || 0,
    p_hotels: g.stats?.hotels || 0,
    p_trades: g.stats?.trades || 0,
    p_bankrupt: g.stats?.bankruptcies || 0,
    p_reason: g.endReason || null,
  }
  const payload = { uids: [...new Set(uids)], args }
  const wuid = winner && !winner.isBot ? uidOf(winner.id) : null
  if (wuid) payload.winner_uid = wuid
  return { id: g.id, game: 'monopoly', payload }
}

export async function confirmReport(report) {
  const uid = await myUid()
  if (!uid || !report?.payload?.uids?.includes(uid)) return
  const { error } = await sb.rpc('report_game', { p_game: 'monopoly', p_payload: report.payload })
  if (error) console.warn('report_game', error.message)
}
