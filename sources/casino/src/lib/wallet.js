// Solde du Casino : tenu par le serveur (table wallets). Ici, seulement un cache d'affichage.
// Les gains et pertes sont calculés et écrits par l'Edge Function casino-table ; le navigateur
// ne peut que lire son solde, choisir son pseudo et emprunter quand il est à sec.
import { notifyLocalChange } from "./cloudSave.js";
import { rpc } from "./identity.js";

const WALLET_KEY = "casino3d-wallet";

export const START_BANKROLL = 1000;

let cache = (() => {
  try {
    const w = JSON.parse(localStorage.getItem(WALLET_KEY) || "null") || {};
    return { bankroll: null, debt: 0, name: typeof w.name === "string" ? w.name : "", banned: false };
  } catch {
    return { bankroll: null, debt: 0, name: "", banned: false };
  }
})();

function keep(next) {
  cache = { ...cache, ...next };
  try {
    const w = JSON.parse(localStorage.getItem(WALLET_KEY) || "{}");
    localStorage.setItem(WALLET_KEY, JSON.stringify({ ...w, name: cache.name }));
  } catch {}
  window.dispatchEvent(new Event("casino-save"));
  return cache;
}

const fromServer = (d) => ({
  bankroll: Number(d.bankroll),
  debt: Number(d.debt) || 0,
  name: d.pseudo || cache.name || "",
  banned: !!d.banned,
});

// bankroll === null tant que le serveur n'a pas répondu
export function loadWallet() {
  return { ...cache };
}

export async function refreshWallet() {
  return keep(fromServer(await rpc("wallet_me")));
}

const PSEUDO_ERRORS = {
  "pseudo deja pris": "Ce pseudo est déjà pris par un autre joueur.",
  "pseudo banni": "Ce pseudo est banni pour triche.",
  "pseudo invalide": "Pseudo invalide (1 à 16 caractères).",
};

// Réserve le pseudo côté serveur (unique) : c'est lui qui apparaît aux tables et aux classements
export async function claimPseudo(name) {
  name = String(name || "").trim();
  if (!name || name === "Joueur") return cache;
  try {
    return keep(fromServer(await rpc("wallet_set_pseudo", { p: name })));
  } catch (e) {
    const key = Object.keys(PSEUDO_ERRORS).find((k) => e.message.includes(k));
    throw new Error(key ? PSEUDO_ERRORS[key] : e.message);
  }
}

export async function borrow() {
  return keep(fromServer(await rpc("wallet_borrow")));
}

// Seul le pseudo saisi est retenu localement (pré-remplissage) ; le solde n'est jamais écrit ici
export function saveWallet(patch) {
  if (patch && typeof patch.name === "string") {
    keep({ name: patch.name });
    notifyLocalChange();
  }
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
