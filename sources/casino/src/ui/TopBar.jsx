import React from "react";
import { sound } from "../lib/sound.js";
import { Balance } from "./Balance.jsx";
import { RngModal } from "./RngModal.jsx";

export function TopBar({ ctrl, state, me, game, title, onQuit, extra }) {
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
    <>
      <header className="topbar">
        <div className="brand">
          {"♠ "}
          {title}
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
        <Balance
          me={me}
          inPlay={
            state.phase === "settle" && game === "roulette" ? 0 : undefined
          }
        />
        {extra}
        <button
          className="icon"
          onClick={() => setMuted(sound.toggle())}
          title="Son"
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="icon" onClick={onQuit} title="Quitter">
          ✕
        </button>
      </header>
      {showRng && (
        <RngModal
          game={game}
          rng={state.rng}
          proofPrev={state.proofPrev}
          onClose={() => setShowRng(false)}
        />
      )}
    </>
  );
}
