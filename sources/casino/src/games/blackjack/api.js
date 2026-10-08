import { supabase } from "../../lib/supabase.js";

const sessionId = (() => {
  try {
    let id = sessionStorage.getItem("bj3d-session");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("bj3d-session", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
})();

export async function saveBlackjackSession(s) {
  if (!s || s.hands_played <= 0) return;
  const { error } = await supabase.rpc("save_blackjack_session", {
    p_id: sessionId,
    p_hands_played: s.hands_played,
    p_hands_won: s.hands_won,
    p_hands_lost: s.hands_lost,
    p_hands_push: s.hands_push,
    p_total_wagered: s.total_wagered,
    p_net_result: s.net_result,
    p_splits_used: s.splits_used,
    p_doubles_used: s.doubles_used,
    p_blackjacks_hit: s.blackjacks_hit,
    p_final_bankroll: s.final_bankroll,
    p_peak: s.peak,
    p_drawdown: s.drawdown,
    p_credit: s.credit,
  });
  if (error) {
    console.warn("saveSession", error.message);
  }
}

export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc("get_blackjack_leaderboard");
  if (error) throw error;
  return data || [];
}

export async function submitScore({ pseudo, bankroll, hands, won }) {
  const { error } = await supabase.from("blackjack_leaderboard").insert({
    pseudo: pseudo.trim().slice(0, 20),
    final_bankroll: Math.round(bankroll),
    hands_played: hands,
    hands_won: won,
  });
  if (error) throw error;
}
