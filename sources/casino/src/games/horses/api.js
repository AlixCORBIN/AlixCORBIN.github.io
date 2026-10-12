import { supabase } from "../../lib/supabase.js";
import { FINISH } from "./engine.js";

// Appelé une seule fois par l'hôte en fin de partie (RPC save_horses_game, doublon ignoré côté base).
export async function saveHorsesGame(g) {
  const players = g.players.map((p) => ({
    pseudo: p.name,
    bot: !!p.bot,
    won: p.id === g.winner,
    captures: p.captures,
    home: p.horses.filter((x) => x === FINISH).length,
  }));
  const s = g.stats;
  const { error } = await supabase.rpc("save_horses_game", {
    p_id: g.gameId || crypto.randomUUID(),
    p_duration: Math.round(((g.endedAt || Date.now()) - (g.startedAt || Date.now())) / 1000),
    p_rolls: s.rolls,
    p_sixes: s.sixes,
    p_captures: s.captures,
    p_moves: s.moves,
    p_players: players,
  });
  if (error) console.warn("saveHorsesGame", error.message);
}
