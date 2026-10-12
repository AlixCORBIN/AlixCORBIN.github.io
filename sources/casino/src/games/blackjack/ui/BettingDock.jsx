import "../../../styles/paytable.css";
import React from "react";
import { CHIPS } from "../chips.js";
import { RULES } from "../engine.js";
import { sound } from "../../../lib/sound.js";

const CHIP_VALUES = [...CHIPS]
  .reverse()
  .map((c) => c.v)
  .sort((a, b) => a - b);

const CHIP_BY_VALUE = Object.fromEntries(CHIPS.map((c) => [c.v, c]));

const PAYTABLE = {
  bet: [["Gain", 1], ["Blackjack", 1.5]],
  pp: [["Paire mixte", 5], ["Paire de couleur", 12], ["Paire parfaite", 25]],
  t3: [
    ["Couleur", 5],
    ["Suite", 10],
    ["Brelan", 30],
    ["Quinte flush", 40],
    ["Brelan assorti", 100],
  ],
};

export function BettingDock({ ctrl, state, me }) {
  const [spot, setSpot] = React.useState("bet");
  const [showGains, setShowGains] = React.useState(false);
  const limits = {
    bet: RULES.maxBet,
    pp: RULES.sideMax,
    t3: RULES.sideMax,
  };
  const bets = {
    bet: me.bet,
    pp: me.pp,
    t3: me.t3,
  };
  const total = me.bet + me.pp + me.t3;
  const sendBets = (patch) =>
    ctrl.act({
      t: "bet",
      ...patch,
    });
  const addChip = (value) => {
    const next = Math.min(limits[spot], bets[spot] + value);
    if (total - bets[spot] + next <= me.bankroll) {
      sound.chip();
      sendBets({
        ...bets,
        [spot]: next,
      });
    }
  };
  const broke = me.bankroll < RULES.minBet && total === 0;
  const SPOTS = [
    ["pp", "Perfect Pairs"],
    ["bet", "Mise"],
    ["t3", "21+3"],
  ];
  const waiting = state.players.filter((p) => !p.ready).map((p) => p.name);
  return broke ? (
    <div className="dock">
      <p>Plus de jetons !</p>
      <button
        className="btn primary"
        onClick={() =>
          ctrl.act({
            t: "credit",
          })
        }
      >
        {"Recevoir "}
        {RULES.creditAmount}
        {" a credit (emprunt, deduit de ton score)"}
      </button>
    </div>
  ) : (
    <div className="dock">
      <div className="spots">
        {SPOTS.map(([key, label]) => (
          <button
            key={key}
            disabled={me.ready}
            className={"spot" + (spot === key ? " on" : "")}
            onClick={() => setSpot(key)}
          >
            <small>{label}</small>
            <b>{bets[key]}</b>
            {showGains && bets[key] > 0 && (
              <small>
                {key === "bet"
                  ? `BJ +${Math.floor(bets[key] * 1.5)}`
                  : `max +${bets[key] * PAYTABLE[key][PAYTABLE[key].length - 1][1]}`}
              </small>
            )}
          </button>
        ))}
        <button
          className={"spot" + (showGains ? " on" : "")}
          onClick={() => setShowGains((v) => !v)}
        >
          <small>Gains</small>
          <b>{showGains ? "ON" : "OFF"}</b>
        </button>
      </div>
      {showGains && (
        <div className="paytable">
          {PAYTABLE[spot].map(([name, m]) => (
            <span key={name}>
              {name} <b>{m}:1</b>
              {bets[spot] > 0 && ` (+${Math.floor(bets[spot] * m)})`}
            </span>
          ))}
        </div>
      )}
      <div className="chips">
        {CHIP_VALUES.map((v) => (
          <button
            key={v}
            disabled={me.ready}
            className="chipbtn"
            style={{
              "--c": CHIP_BY_VALUE[v].c,
              "--e": CHIP_BY_VALUE[v].e,
            }}
            onClick={() => addChip(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="row">
        <button
          className="btn ghost"
          disabled={me.ready || !total}
          onClick={() =>
            sendBets({
              ...bets,
              [spot]: 0,
            })
          }
        >
          Effacer
        </button>
        <button
          className="btn ghost"
          disabled={me.ready || me.bankroll - (total - bets[spot]) <= 0}
          onClick={() => {
            sound.chip();
            sendBets({
              ...bets,
              [spot]: Math.floor(me.bankroll - (total - bets[spot])),
            });
          }}
        >
          Tout
        </button>
        <button
          className="btn ghost"
          disabled={me.ready || !me.lastBets.bet}
          onClick={() =>
            ctrl.act({
              t: "rebet",
            })
          }
        >
          Re-miser
        </button>
        {me.ready ? (
          <button
            className="btn"
            onClick={() =>
              ctrl.act({
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
            onClick={() =>
              ctrl.act({
                t: "ready",
              })
            }
          >
            {me.bet > 0
              ? state.players.length > 1
                ? "Prêt"
                : "Distribuer"
              : "Passer ce tour"}
          </button>
        )}
      </div>
      {me.ready && waiting.length > 0 && (
        <p className="hint">
          {"En attente de "}
          {waiting.join(", ")}...
        </p>
      )}
      {ctrl.lastError && <p className="hint err">{ctrl.lastError}</p>}
    </div>
  );
}
