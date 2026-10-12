// Identité côté serveur : la session du compte (Google / email) si on est connecté,
// sinon une connexion anonyme créée automatiquement et gardée dans ce navigateur.
// C'est elle qui porte le solde (table wallets) : le navigateur ne peut plus l'écrire.
import { account } from "./mii.js";
import { SUPABASE_KEY, SUPABASE_URL } from "./supabase.js";

let pending = null;

export async function session() {
  if (!account) throw new Error("Connexion au serveur impossible");
  await account.ready;
  let { data } = await account.sb.auth.getSession();
  if (!data.session) {
    pending ||= account.sb.auth.signInAnonymously().finally(() => {
      pending = null;
    });
    const { error } = await pending;
    if (error) throw new Error("Connexion au serveur impossible : " + error.message);
    ({ data } = await account.sb.auth.getSession());
  }
  if (!data.session) throw new Error("Connexion au serveur impossible");
  return data.session;
}

export async function myUid() {
  try {
    return (await session()).user.id;
  } catch {
    return null;
  }
}

// Client Supabase authentifié (RPC wallet_*, report_game, Realtime des tables)
export const db = () => account.sb;

export async function rpc(fn, args) {
  await session();
  const { data, error } = await account.sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function callFunction(name, body) {
  const s = await session();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.access_token}`, apikey: SUPABASE_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: "Reponse invalide du serveur" }));
  if (!res.ok && !json.view) throw Object.assign(new Error(json.error || "Erreur serveur " + res.status), { status: res.status });
  return json;
}
