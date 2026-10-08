import React from "react";
import { ActionDock } from "./ActionDock.jsx";
import { BettingDock } from "./BettingDock.jsx";
import { InsuranceDock } from "./InsuranceDock.jsx";
import { Leaderboard } from "./Leaderboard.jsx";
import { SettleDock } from "./SettleDock.jsx";
import { sound } from "../../../lib/sound.js";
import { AfkToast } from "../../../ui/AfkToast.jsx";
import { Balance } from "../../../ui/Balance.jsx";
import { RngModal } from "../../../ui/RngModal.jsx";

export function BlackjackHud({ ctrl, state, me, onQuit }) {
  const [showBoard, setShowBoard] = React.useState(false);
  const [showRng, setShowRng] = React.useState(false);
  const [muted, setMuted] = React.useState(sound.isMuted());
  const [copied, setCopied] = React.useState(false);
  const inviteUrl = ctrl.code
    ? `${location.origin}${location.pathname}?room=${ctrl.code}`
    : null;
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="hud">
      <header>
        <div className="brand">
          {"♠ Blackjack "}
          <em>3D</em>
        </div>
        {ctrl.code && (
          <button
            className="pill"
            onClick={copyInvite}
            title="Copier le lien d'invitation"
          >
            {"Salle "}
            <b>{ctrl.code}</b>
            {" · "}
            {copied ? "copie !" : "copier le lien"}
          </button>
        )}
        <div className="grow" />
        <button
          className={
            "pill rng " + (state.rng.source === "random.org" ? "ok" : "warn")
          }
          onClick={() => setShowRng(true)}
          title="Generateur aleatoire"
        >
          <i />
          {" RNG "}
          {state.rng.source === "random.org" ? "random.org" : "local"}
        </button>
        <Balance me={me} />
        <div className="stat hide-sm">
          <small>Mains</small>
          <b>{me.stats.played}</b>
        </div>
        <button
          className="icon"
          onClick={() => setMuted(sound.toggle())}
          title="Son"
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          className="icon"
          onClick={() => setShowBoard(true)}
          title="Classement"
        >
          🏆
        </button>
        <button className="icon" onClick={onQuit} title="Quitter">
          ✕
        </button>
      </header>
      {state.notice && <div className="toast">{state.notice}</div>}
      <AfkToast afk={state.afk} state={state} me={me} />
      {state.phase === "betting" && (
        <BettingDock ctrl={ctrl} state={state} me={me} />
      )}
      {state.phase === "insurance" && <InsuranceDock ctrl={ctrl} me={me} />}
      {state.phase === "playing" && (
        <ActionDock ctrl={ctrl} state={state} me={me} />
      )}
      {state.phase === "dealer" && (
        <div className="dock slim">
          <p className="hint">Le croupier joue...</p>
        </div>
      )}
      {state.phase === "settle" && <SettleDock ctrl={ctrl} me={me} />}
      {showBoard && <Leaderboard onClose={() => setShowBoard(false)} />}
      {showRng && (
        <RngModal
          game="blackjack"
          rng={state.rng}
          proofPrev={state.proofPrev}
          onClose={() => setShowRng(false)}
        />
      )}
    </div>
  );
}
