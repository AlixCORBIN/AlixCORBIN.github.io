import React from "react";
import { ROULETTE_CHIPS } from "../chips.js";
import { totalBet } from "../engine.js";
import { numberColor } from "../rules.js";
import { RouletteScene } from "../three/RouletteScene.jsx";
import { RouletteBoard } from "./RouletteBoard.jsx";
import { sound } from "../../../lib/sound.js";
import { TopBar } from "../../../ui/TopBar.jsx";

export function RouletteScreen({ ctrl, state, me, onQuit }) {
  const [chip, setChip] = React.useState(5);
  const [orient, setOrient] = React.useState("h");
  const boardRef = React.useRef(null);
  React.useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setOrient(
        el.clientWidth < 560 && el.clientHeight > el.clientWidth * 0.9
          ? "v"
          : "h",
      ),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const betting = state.phase === "betting";
  const myTotal = totalBet(me);
  const act = (key) => ctrl.act(key);
  const bet = (msg) => {
    if (chip <= me.bankroll) {
      sound.chip();
      act({
        t: "bet",
        key: msg,
        amount: chip,
      });
    }
  };
  const winning = state.phase === "settle" ? state.result : null;
  const multi = state.players.length > 1;
  const [countdown, setCountdown] = React.useState(null);
  React.useEffect(() => {
    if (!state.deadline) {
      setCountdown(null);
      return;
    }
    const endAt = Date.now() + state.deadline.ms;
    const tick = () =>
      setCountdown(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [state.deadline]);
  const prevPhase = React.useRef(null);
  React.useEffect(() => {
    if (prevPhase.current && prevPhase.current !== state.phase) {
      if (state.phase === "spinning") {
        sound.turn();
      }
      if (state.phase === "settle") {
        (me.net > 0 ? sound.win : me.net < 0 ? sound.lose : sound.chip)();
      }
    }
    prevPhase.current = state.phase;
  }, [state.phase]);
  const color = state.result === null ? null : numberColor(state.result);
  const status =
    state.phase === "betting"
      ? "Faites vos jeux"
      : state.phase === "spinning"
        ? "Rien ne va plus"
        : null;
  return (
    <div className="r-root">
      <TopBar
        ctrl={ctrl}
        state={state}
        me={me}
        game="roulette"
        title="Roulette Européenne"
        onQuit={onQuit}
      />
      <div className="r-stage">
        <RouletteScene state={state} />
        <div className="r-history">
          {state.history.map((n, i) => (
            <span key={i} className={"dot " + numberColor(n)}>
              {n}
            </span>
          ))}
        </div>
        {status && (
          <div className="r-status">
            {status}
            {countdown !== null && state.phase === "betting"
              ? ` · ${countdown}s`
              : ""}
          </div>
        )}
        {state.phase === "settle" && (
          <div className="r-result">
            <div className={"big " + color}>{state.result}</div>
            {myTotal + me.win >= 0 && me.net !== 0 && (
              <div className={"net " + (me.net > 0 ? "pos" : "neg")}>
                {me.net > 0 ? "+" : ""}
                {me.net}
              </div>
            )}
          </div>
        )}
        {multi && (
          <div className="r-players">
            {state.players.map((p) => (
              <div key={p.id} className={"rp" + (p.id === me.id ? " me" : "")}>
                <b>{p.name}</b>
                <span>{totalBet(p) > 0 ? `mise ${totalBet(p)}` : "—"}</span>
                {state.phase === "settle" && p.net !== 0 && (
                  <em className={p.net > 0 ? "pos" : "neg"}>
                    {p.net > 0 ? "+" : ""}
                    {p.net}
                  </em>
                )}
                {betting && p.ready && <em className="pos">prêt</em>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="r-side">
        <div className="board-wrap" ref={boardRef}>
          <RouletteBoard
            orient={orient}
            myBets={me.bets}
            chip={chip}
            disabled={!betting || me.ready}
            onBet={bet}
            winning={winning}
          />
        </div>
        <div className="r-controls">
          {betting && me.bankroll < 1 && myTotal === 0 && (
            <button
              className="btn primary"
              style={{
                width: "100%",
              }}
              onClick={() =>
                act({
                  t: "credit",
                })
              }
            >
              Plus de jetons : emprunter 500 (déduits de ton score)
            </button>
          )}
          <div className="rchips">
            {ROULETTE_CHIPS.map((c) => (
              <button
                key={c.v}
                className={"chipbtn" + (chip === c.v ? " sel" : "")}
                disabled={c.v > me.bankroll}
                style={{
                  "--c": c.c,
                  "--e": c.e,
                }}
                onClick={() => setChip(c.v)}
              >
                {c.v >= 1000 ? c.v / 1000 + "k" : c.v}
              </button>
            ))}
          </div>
          <div className="row">
            <button
              className="btn ghost"
              disabled={!betting || me.ready || !me.bets.length}
              onClick={() =>
                act({
                  t: "undo",
                })
              }
            >
              Annuler
            </button>
            <button
              className="btn ghost"
              disabled={!betting || me.ready || !me.bets.length}
              onClick={() =>
                act({
                  t: "clear",
                })
              }
            >
              Effacer
            </button>
            <button
              className="btn ghost"
              disabled={!betting || me.ready || !me.lastBets.length}
              onClick={() =>
                act({
                  t: "rebet",
                })
              }
            >
              Re-miser
            </button>
            <button
              className="btn ghost"
              disabled={
                !betting || me.ready || !me.bets.length || myTotal > me.bankroll
              }
              onClick={() =>
                act({
                  t: "double",
                })
              }
            >
              x2
            </button>
            {state.auto ? null : state.phase === "settle" ? (
              <button
                className="btn primary"
                onClick={() =>
                  act({
                    t: "next",
                  })
                }
              >
                Manche suivante
              </button>
            ) : me.ready ? (
              <button
                className="btn"
                disabled={!betting}
                onClick={() =>
                  act({
                    t: "ready",
                    v: false,
                  })
                }
              >
                Annuler
              </button>
            ) : (
              <button
                className="btn primary"
                disabled={!betting || !me.bets.length}
                onClick={() =>
                  act({
                    t: "ready",
                  })
                }
              >
                Lancer{multi ? " (prêt)" : ""}
              </button>
            )}
          </div>
          <div className="hint">
            {"Mise totale : "}
            <b>{myTotal}</b>
            {ctrl.lastError ? ` · ${ctrl.lastError}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
