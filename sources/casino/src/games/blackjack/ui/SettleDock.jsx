import React from "react";
import { submitScore } from "../api.js";
import { loadWallet } from "../../../lib/wallet.js";

export function SettleDock({ ctrl, me }) {
  const [saved, setSaved] = React.useState(false);
  const net = Math.round(me.net);
  if (!me.hands.length)
    return (
      <div className="dock slim">
        <p className="hint">Manche terminee</p>
      </div>
    );
  const save = async () => {
    try {
      await submitScore({
        pseudo: me.name,
        bankroll: me.bankroll - loadWallet().debt,
        hands: me.stats.played,
        won: me.stats.won,
      });
      setSaved(true);
    } catch {
      setSaved("err");
    }
  };
  return (
    <div className="dock">
      <div className={"net " + (net > 0 ? "pos" : net < 0 ? "neg" : "")}>
        {net > 0 ? `+${net}` : net === 0 ? "Egalite" : net}
      </div>
      <div className="row">
        <button
          className="btn primary"
          onClick={() =>
            ctrl.act({
              t: "next",
            })
          }
        >
          Main suivante
        </button>
        <button className="btn ghost" disabled={saved === true} onClick={save}>
          {saved === true
            ? "Score enregistre"
            : saved === "err"
              ? "Echec, reessayer"
              : "Enregistrer mon score"}
        </button>
      </div>
    </div>
  );
}
