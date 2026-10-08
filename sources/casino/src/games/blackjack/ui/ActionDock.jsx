import React from "react";
import { availableActions } from "../engine.js";

export function ActionDock({ ctrl, state, me }) {
  const current = state.turn && state.players[state.turn.p];
  const myTurn = current && current.id === me.id;
  const can = myTurn
    ? availableActions(
        {
          ...state,
          phase: state.phase,
        },
        me.id,
      )
    : null;
  const send = (type) => () =>
    ctrl.act({
      t: type,
    });
  React.useEffect(() => {
    if (!myTurn) return;
    const onKey = (ev) => {
      const key = ev.key.toLowerCase();
      if (key === "h" && can.hit) {
        ctrl.act({
          t: "hit",
        });
      } else if (key === "s" && can.stand) {
        ctrl.act({
          t: "stand",
        });
      } else if (key === "d" && can.double) {
        ctrl.act({
          t: "double",
        });
      } else if (key === "p" && can.split) {
        ctrl.act({
          t: "split",
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return myTurn ? (
    <div className="dock">
      <div className="row">
        <button
          className="btn act hit"
          disabled={!can.hit}
          onClick={send("hit")}
        >
          {"Tirer "}
          <kbd>H</kbd>
        </button>
        <button
          className="btn act stand"
          disabled={!can.stand}
          onClick={send("stand")}
        >
          {"Rester "}
          <kbd>S</kbd>
        </button>
        <button
          className="btn act dbl"
          disabled={!can.double}
          onClick={send("double")}
        >
          {"Doubler "}
          <kbd>D</kbd>
        </button>
        <button
          className="btn act split"
          disabled={!can.split}
          onClick={send("split")}
        >
          {"Separer "}
          <kbd>P</kbd>
        </button>
      </div>
    </div>
  ) : (
    <div className="dock slim">
      <p className="hint">
        {current ? `Tour de ${current.name}...` : "Le croupier joue..."}
      </p>
    </div>
  );
}
