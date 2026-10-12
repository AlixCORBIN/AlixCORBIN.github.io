import { supabase } from "../../lib/supabase.js";

// Appelé une seule fois par l'hôte en fin de partie (RPC save_naval_game, doublon ignoré côté base).
export async function saveNavalGame(g) {
  const players = g.players.map((p) => ({
    pseudo: p.name,
    bot: !!p.bot,
    won: p.id === g.winner,
    shots: p.fired,
    hits: p.hits,
  }));
  const { error } = await supabase.rpc("save_naval_game", {
    p_id: g.gameId || crypto.randomUUID(),
    p_duration: Math.round(((g.endedAt || Date.now()) - (g.startedAt || Date.now())) / 1000),
    p_players: players,
  });
  if (error) console.warn("saveNavalGame", error.message);
}
