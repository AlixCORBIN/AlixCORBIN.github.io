import React from "react";
import { cloudSave, summarize } from "../lib/cloudSave.js";

const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
const when = (iso) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "maintenant";

// Plusieurs sauvegardes différentes sur le compte : le joueur choisit celle à garder.
export function SaveChooser() {
  const { choices } = React.useSyncExternalStore(cloudSave.subscribe, cloudSave.get);
  const [busy, setBusy] = React.useState(false);
  if (!choices) return null;
  const pick = async (c) => {
    setBusy(true);
    try { await cloudSave.choose(c); } finally { setBusy(false); }
  };
  return (
    <div className="modal">
      <div className="panel save-chooser">
        <h2>Quelle sauvegarde garder ?</h2>
        <p className="hint">
          Ton compte a plusieurs sauvegardes différentes. Celle que tu choisis sera utilisée sur tous tes navigateurs.
        </p>
        <div className="save-list">
          {choices.map((c) => {
            const s = summarize(c.data);
            return (
              <button key={c.key} className="save-item" disabled={busy} onClick={() => pick(c)}>
                <span className="save-head">
                  <b>{c.label}</b>
                  <small>{when(c.at)}</small>
                </span>
                <span className="save-stats">
                  <span>● {fmt(s.bankroll)} jetons</span>
                  {s.debt > 0 && <span>dette {fmt(s.debt)}</span>}
                  {s.records > 0 && <span>🏁 {s.records} record{s.records > 1 ? "s" : ""}</span>}
                  {s.name && <span>« {s.name} »</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
