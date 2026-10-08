const WALLET_KEY = "casino3d-wallet";

export const START_BANKROLL = 1000;

export function loadWallet() {
  try {
    const w = JSON.parse(localStorage.getItem(WALLET_KEY) || "null");
    if (w && Number.isFinite(w.bankroll))
      return {
        bankroll: Math.max(0, Math.floor(w.bankroll)),
        name: w.name || "",
        debt: Math.max(0, Math.floor(w.debt || 0)),
      };
  } catch {}
  return {
    bankroll: START_BANKROLL,
    name: "",
    debt: 0,
  };
}

export function saveWallet(patch) {
  try {
    const current = loadWallet();
    localStorage.setItem(
      WALLET_KEY,
      JSON.stringify({
        ...current,
        ...patch,
      }),
    );
  } catch {}
}

export function settledBankroll(state, me) {
  return !state || !me
    ? null
    : state.game === "roulette"
      ? state.phase === "betting"
        ? me.bankroll + me.bets.reduce((sum, b) => sum + b.amount, 0)
        : state.phase === "settle"
          ? me.bankroll
          : null
      : state.phase === "betting" || state.phase === "settle"
        ? me.bankroll
        : null;
}
