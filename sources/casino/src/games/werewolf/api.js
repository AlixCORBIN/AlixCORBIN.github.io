import { supabase } from "../../lib/supabase.js";
import { ROLES } from "./roles.js";

// Appelé une seule fois par l'hôte en fin de partie.
export async function saveWerewolfGame(g) {
  const camp = { village: "village", wolves: "wolves", lovers: "solo", none: "none" }[g.winner] || "none";
  const players = g.players.map((p) => ({
    pseudo: p.name,
    bot: !!p.bot,
    role: ROLES[p.role]?.name || "?",
    camp: ROLES[p.role]?.team || "?",
    won: !!p.won,
    alive: p.alive,
  }));
  const { error } = await supabase.rpc("save_werewolf_game", {
    p_id: crypto.randomUUID(),
    p_nights: g.day,
    p_duration: Math.round((Date.now() - (g.startedAt || Date.now())) / 1000),
    p_winner_camp: camp,
    p_votes: g.stats?.votes || 0,
    p_night_kills: g.stats?.kills || 0,
    p_players: players,
  });
  if (error) console.warn("saveWerewolfGame", error.message);
}
