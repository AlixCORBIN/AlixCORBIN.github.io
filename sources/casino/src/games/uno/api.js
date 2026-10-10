import { supabase } from "../../lib/supabase.js";

// Appelé une seule fois par l'hôte en fin de partie (RPC save_uno_game, doublon ignoré côté base).
export async function saveUnoGame(g) {
  const players = g.players.map((p) => ({
    pseudo: p.name,
    bot: !!p.bot,
    won: p.id === g.winner,
    score: p.score,
    cards_left: p.hand.length,
  }));
  const { error } = await supabase.rpc("save_uno_game", {
    p_id: g.gameId || crypto.randomUUID(),
    p_rounds: g.round,
    p_duration: Math.round(((g.endedAt || Date.now()) - (g.startedAt || Date.now())) / 1000),
    p_turns: g.stats.turns,
    p_specials: g.stats.specials,
    p_draws: g.stats.draws,
    p_challenges: g.stats.challenges,
    p_catches: g.stats.catches,
    p_target: g.settings.target,
    p_players: players,
  });
  if (error) console.warn("saveUnoGame", error.message);
}
