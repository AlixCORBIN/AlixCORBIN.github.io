import React from "react";
import { saveBlackjackSession } from "./games/blackjack/api.js";
import { sessionStats } from "./games/blackjack/engine.js";
import { BlackjackScene } from "./games/blackjack/three/BlackjackScene.jsx";
import { BlackjackHud } from "./games/blackjack/ui/BlackjackHud.jsx";
import { saveRouletteSession } from "./games/roulette/api.js";
import { RouletteScreen } from "./games/roulette/ui/RouletteScreen.jsx";
import { sound } from "./lib/sound.js";
import { loadWallet, saveWallet, settledBankroll } from "./lib/wallet.js";

export function GameScreen({ ctrl, onQuit }) {
  React.useSyncExternalStore(ctrl.subscribe, ctrl.getSnapshot);
  const state = ctrl.state;
  const me = state?.players.find((p) => p.id === ctrl.me);
  const debtAtStart = React.useRef(loadWallet().debt);
  const credit = me?.stats?.credit || 0;
  React.useEffect(() => {
    if (me) {
      saveWallet({
        debt: debtAtStart.current + credit,
      });
    }
  }, [credit, !!me]);
  React.useEffect(() => {
    const bankroll = settledBankroll(state, me);
    if (bankroll !== null) {
      saveWallet({
        bankroll,
      });
    }
  }, [state?.phase, state?.round, me?.bankroll]);
  const savedRound = React.useRef(0);
  React.useEffect(() => {
    if (
      state?.game === "blackjack" &&
      state?.phase === "settle" &&
      me &&
      savedRound.current !== state.round
    ) {
      savedRound.current = state.round;
      saveBlackjackSession(sessionStats(me));
    }
    if (
      state?.game === "roulette" &&
      state?.phase === "settle" &&
      me?.bets.length &&
      savedRound.current !== state.round
    ) {
      savedRound.current = state.round;
      saveRouletteSession(me);
    }
  }, [state?.phase, state?.round]);
  const prev = React.useRef({});
  React.useEffect(() => {
    if (!state || state.game === "roulette") return;
    const last = prev.current;
    const cardCount =
      state.players.reduce(
        (sum, p) => sum + p.hands.reduce((s, h) => s + h.cards.length, 0),
        0,
      ) + state.dealer.cards.length;
    if (last.cards !== undefined && cardCount > last.cards) {
      sound.card();
    }
    if (last.phase !== "settle" && state.phase === "settle" && me) {
      (me.net > 0 ? sound.win : me.net < 0 ? sound.lose : () => {})();
    }
    if (
      state.phase === "playing" &&
      state.turn &&
      state.players[state.turn.p]?.id === ctrl.me &&
      last.turnKey !== `${state.round}${state.turn.h}`
    ) {
      sound.turn();
    }
    prev.current = {
      cards: cardCount,
      phase: state.phase,
      turnKey: state.turn ? `${state.round}${state.turn.h}` : null,
    };
  });
  return ctrl.status === "error" ? (
    <div className="center-screen">
      <div className="panel">
        <h2>Connexion impossible</h2>
        <p>{ctrl.error}</p>
        <button className="btn primary" onClick={onQuit}>
          Retour
        </button>
      </div>
    </div>
  ) : !state || !me ? (
    <div className="center-screen">
      <div className="panel">
        <div className="spinner" />
        <p>Connexion a la table...</p>
      </div>
    </div>
  ) : state.game === "roulette" ? (
    <RouletteScreen ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
  ) : (
    <>
      <BlackjackScene state={state} me={ctrl.me} />
      <BlackjackHud ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
    </>
  );
}
