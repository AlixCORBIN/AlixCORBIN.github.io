import { reportResult } from "../../lib/report.js";
import { supabase } from "../../lib/supabase.js";

// Appelé une seule fois par l'hôte en fin de partie (RPC save_buckshot_game, doublon ignoré côté base).
export async function saveBuckshotGame(g) {
  const players = g.players.map((p) => ({ pseudo: p.name,
    id: p.id, bot: !!p.bot, won: p.id === g.winner, rounds_won: p.wins }));
  const s = g.stats;
  const { error } = await reportResult("buckshot", {
    p_id: g.gameId || crypto.randomUUID(),
    p_rounds: g.round,
    p_duration: Math.round(((g.endedAt || Date.now()) - (g.startedAt || Date.now())) / 1000),
    p_loads: s.loads,
    p_shots: s.shots,
    p_hits: s.hits,
    p_self_blanks: s.selfBlanks,
    p_items: s.items,
    p_damage: s.damage,
    p_players: players,
  });
  if (error) console.warn("saveBuckshotGame", error.message);
}
