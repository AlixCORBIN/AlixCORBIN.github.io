import React from "react";
import { account, listSync, GUEST_MIIS, loadPlayMii, miiStore, savePlayMii } from "../lib/mii.js";
import { myUid, session } from "../lib/identity.js";
import { claimPseudo } from "../lib/wallet.js";
import { MiiChooser, MiiPortrait } from "./MiiPicker.jsx";
import "../styles/mii.css";

// Pseudo par défaut d'un compte qui n'en a pas encore : « Invité » + 4 caractères de son identifiant
export const guestName = (uid) => "Invité " + String(uid || "").replace(/-/g, "").slice(0, 4).toUpperCase();

// Bouton « Compte » du hub : Mii + pseudo, et un menu pour changer de Mii, de pseudo, se connecter ou créer un compte.
// Le compte du Casino existe toujours (session anonyme automatique) : « créer un compte » le rattache à un
// e-mail ou à Google SANS perdre les jetons ni les records ; « se connecter » bascule sur un compte existant.
export function AccountMenu({ mii, onMii, name, onName }) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState("main"); // main | mii | pseudo | create | login
  const [user, setUser] = React.useState(account?.user || null);
  const [draft, setDraft] = React.useState(name);
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const box = React.useRef(null);

  React.useEffect(() => {
    const off = account?.onChange((u) => setUser(u)) || (() => {});
    account?.ready.then(() => setUser(account.user));
    // le Mii choisi peut disparaître (supprimé dans la chaîne Mii) : on retombe sur un Mii valide
    const offMii = miiStore.subscribe(() => {
      const all = [...listSync(), ...GUEST_MIIS];
      if (!mii || !all.some((m) => m.id === mii.id)) onMii(loadPlayMii());
    });
    return () => { off(); offMii(); };
  }, [mii?.id]);
  React.useEffect(() => setDraft(name), [name]);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const go = (v) => { setMsg(""); setView(v); };
  const run = async (fn) => {
    setMsg("");
    setBusy(true);
    try { await fn(); } catch (e) { setMsg(e.message || String(e)); }
    setBusy(false);
  };
  const pickMii = (m) => { savePlayMii(m.id); onMii(m); go("main"); };
  const savePseudo = () => run(async () => {
    const w = await claimPseudo(draft.trim());
    onName(w.name || draft.trim());
    go("main");
  });
  // Créer un compte = rattacher le compte actuel (anonyme) : la progression est gardée
  const createEmail = () => run(async () => {
    await session();
    const { error } = await account.sb.auth.updateUser({ email: email.trim() });
    if (error) throw new Error(/already/i.test(error.message) ? "Un compte existe déjà avec cette adresse : utilise « Se connecter »." : error.message);
    setMsg("Lien envoyé : clique dessus dans ton mail pour valider le compte, puis choisis un mot de passe ici.");
  });
  const createGoogle = () => run(async () => {
    await session();
    const { error } = await account.sb.auth.linkIdentity({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    if (error) throw new Error(/already/i.test(error.message) ? "Ce compte Google a déjà un compte : utilise « Se connecter avec Google »." : error.message);
  });
  // Se connecter = basculer sur un compte existant (la progression invitée reste sur l'ancien compte)
  const loginEmail = () => run(async () => { await account.signIn(email.trim(), pass); location.reload(); });
  const loginGoogle = () => run(() => account.google());
  const setPassword = () => run(async () => { await account.updatePassword(pass); setPass(""); setMsg("Mot de passe enregistré."); });
  const logout = () => run(async () => { await account.signOut(); location.reload(); });
  const resetPass = () => run(async () => { await account.resetPassword(email.trim()); setMsg("Mail de réinitialisation envoyé."); });

  const who = user ? (account.displayName() || "").split("@")[0] : "";
  return (
    <div className="acc" ref={box}>
      <button className="acc-btn" onClick={() => { setOpen(!open); go("main"); }} title="Compte">
        <MiiPortrait mii={mii} size={64} />
        <span><b>{name || "…"}</b><small>{user ? "☁ " + (who || "Connecté") : "Compte invité"}</small></span>
      </button>
      {open && (
        <div className="acc-pop mii-pop" role="dialog">
          {view === "main" && (
            <>
              <div className="acc-head">
                <MiiPortrait mii={mii} size={96} />
                <div><b>{name}</b><small>{user ? `Connecté : ${account.displayName()}` : "Compte invité, gardé dans ce navigateur"}</small></div>
              </div>
              <button className="btn" onClick={() => go("mii")}>Changer de Mii</button>
              <button className="btn" onClick={() => go("pseudo")}>Changer de pseudo</button>
              {user ? (
                <>
                  <button className="btn" onClick={() => go("password")}>Mot de passe</button>
                  <button className="btn" disabled={busy} onClick={logout}>Se déconnecter</button>
                </>
              ) : (
                <>
                  <button className="btn primary" onClick={() => go("create")}>Créer un compte</button>
                  <button className="btn" onClick={() => go("login")}>Se connecter</button>
                  <p className="acc-note">Un compte garde tes jetons, records et Mii sur tous tes appareils.</p>
                </>
              )}
            </>
          )}
          {view === "mii" && <MiiChooser value={mii} onPick={pickMii} />}
          {view === "pseudo" && (
            <form className="acc-form" onSubmit={(e) => { e.preventDefault(); savePseudo(); }}>
              <label><small>Pseudo (affiché aux tables et dans les classements)</small>
                <input value={draft} maxLength={16} autoFocus onChange={(e) => setDraft(e.target.value)} />
              </label>
              <button className="btn primary" disabled={busy || !draft.trim()}>Enregistrer</button>
            </form>
          )}
          {view === "create" && (
            <div className="acc-form">
              <p className="acc-note">Tes jetons, records et ton pseudo actuels sont conservés.</p>
              <button className="btn primary" disabled={busy} onClick={createGoogle}>Créer avec Google</button>
              <form onSubmit={(e) => { e.preventDefault(); createEmail(); }}>
                <label><small>Ou avec ton e-mail</small>
                  <input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} />
                </label>
                <button className="btn" disabled={busy}>Recevoir le lien</button>
              </form>
            </div>
          )}
          {view === "login" && (
            <div className="acc-form">
              <p className="acc-note">Tu as déjà un compte : ta progression d'invité sur ce navigateur ne sera pas fusionnée.</p>
              <button className="btn primary" disabled={busy} onClick={loginGoogle}>Se connecter avec Google</button>
              <form onSubmit={(e) => { e.preventDefault(); loginEmail(); }}>
                <label><small>E-mail</small><input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} /></label>
                <label><small>Mot de passe</small><input type="password" value={pass} required onChange={(e) => setPass(e.target.value)} /></label>
                <button className="btn" disabled={busy}>Se connecter</button>
              </form>
              <button className="link" disabled={busy || !email.trim()} onClick={resetPass}>Mot de passe oublié</button>
            </div>
          )}
          {view === "password" && (
            <form className="acc-form" onSubmit={(e) => { e.preventDefault(); setPassword(); }}>
              <label><small>Nouveau mot de passe (6 caractères minimum)</small>
                <input type="password" value={pass} minLength={6} required onChange={(e) => setPass(e.target.value)} />
              </label>
              <button className="btn primary" disabled={busy}>Enregistrer</button>
            </form>
          )}
          {msg && <p className="acc-msg">{msg}</p>}
          {view !== "main" && <button className="link" onClick={() => go("main")}>← Retour</button>}
        </div>
      )}
    </div>
  );
}

// Donne un pseudo « Invité XXXX » aux comptes qui n'en ont pas encore (une fois, côté serveur)
export async function ensureGuestPseudo(current) {
  if (current) return current;
  const uid = await myUid();
  if (!uid) return "";
  const n = guestName(uid);
  try { return (await claimPseudo(n)).name || n; } catch { return n; }
}
