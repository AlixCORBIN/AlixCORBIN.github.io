import { supabase } from "../../lib/supabase.js";

// Une session = un onglet : la ligne est mise à jour (upsert) après chaque tirage.
const sessionId = (() => {
  try {
    let id = sessionStorage.getItem("roulette-session");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("roulette-session", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
})();

export async function saveRouletteSession(player) {
  const s = player?.stats;
  if (!s || s.spins <= 0) return;
  const { error } = await supabase.rpc("save_roulette_session", {
    p_id: sessionId,
    p_pseudo: player.name,
    p_spins: s.spins,
    p_wins: s.wins,
    p_wagered: s.wagered,
    p_net: player.bankroll - player.startBankroll - s.credit,
    p_biggest: s.biggest,
    p_peak: s.peak,
    p_credit: s.credit,
    p_final: player.bankroll,
  });
  if (error) console.warn("saveRouletteSession", error.message);
}

// Appelé uniquement par l'hôte : un tirage = un incrément, même à 8 joueurs.
export async function recordSpin(num) {
  const { error } = await supabase.rpc("record_roulette_spin", { p_num: num });
  if (error) console.warn("recordSpin", error.message);
}
