import { reportResult } from "../../lib/report.js";
import { supabase } from "../../lib/supabase.js";
import { teamMode } from "./engine.js";

// Appelé une seule fois par l'hôte en fin de partie (RPC save_milleborne_game, doublon ignoré côté base).
export async function saveMilleBornesGame(g) {
  const teams = teamMode(g);
  const winner = g.players.find((p) => p.id === g.winner);
  const players = g.players.map((p) => ({
    pseudo: p.name,
    id: p.id,
    bot: !!p.bot,
    won: !!winner && (teams ? p.team === winner.team : p.id === winner.id),
    score: p.score,
    km: p.car?.km || 0,
  }));
  const { error } = await reportResult("milleborne", {
    p_id: g.gameId || crypto.randomUUID(),
    p_teams: teams,
    p_rounds: g.round,
    p_duration: Math.round(((g.endedAt || Date.now()) - (g.startedAt || Date.now())) / 1000),
    p_turns: g.stats.turns,
    p_hazards: g.stats.hazards,
    p_coups: g.stats.coups,
    p_players: players,
  });
  if (error) console.warn("saveMilleBornesGame", error.message);
}
