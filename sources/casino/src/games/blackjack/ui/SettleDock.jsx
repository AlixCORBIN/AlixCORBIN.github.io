import React from "react";

export function SettleDock({ ctrl, me }) {
  const net = Math.round(me.net);
  if (!me.hands.length)
    return (
      <div className="dock slim">
        <p className="hint">Manche terminee</p>
      </div>
    );
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
      </div>
    </div>
  );
}
