import React from "react";
import { BlackjackScene } from "./games/blackjack/three/BlackjackScene.jsx";
import { BlackjackHud } from "./games/blackjack/ui/BlackjackHud.jsx";
import { HorsesScreen } from "./games/horses/ui/HorsesScreen.jsx";
import { BuckshotScreen } from "./games/buckshot/ui/BuckshotScreen.jsx";
import { NavalScreen } from "./games/naval/ui/NavalScreen.jsx";
import { Connect4Screen } from "./games/connect4/ui/Connect4Screen.jsx";
import { UnoScreen } from "./games/uno/ui/UnoScreen.jsx";
import { MbScreen } from "./games/milleborne/ui/MbScreen.jsx";
import { WerewolfScreen } from "./games/werewolf/ui/WerewolfScreen.jsx";
import { RouletteScreen } from "./games/roulette/ui/RouletteScreen.jsx";
import { sound } from "./lib/sound.js";
import { useReportResult } from "./lib/report.js";
import { PublicToggle } from "./ui/PublicToggle.jsx";
import { setCanApply } from "./lib/cloudSave.js";

export function GameScreen({ ctrl, onQuit }) {
  React.useSyncExternalStore(ctrl.subscribe, ctrl.getSnapshot);
  const state = ctrl.state;
  const me = state?.players.find((p) => p.id === ctrl.me);
  React.useEffect(() => {
    setCanApply(false);
    return () => setCanApply(true);
  }, []);
  // Solde, stats de session et classement des jetons : calculés et écrits par le serveur
  // (Edge Function casino-table). Fin de partie des autres jeux : chaque humain confirme le résultat.
  useReportResult(ctrl, state);
  const prev = React.useRef({});
  React.useEffect(() => {
    if (!state || state.game !== "blackjack") return;
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
  ) : (
    <>
      <PublicToggle ctrl={ctrl} />
      {state.game === "buckshot" ? (
    <BuckshotScreen ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
  ) : state.game === "milleborne" ? (
    <MbScreen ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
  ) : state.game === "naval" ? (
    <NavalScreen ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
  ) : state.game === "connect4" ? (
    <Connect4Screen ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
  ) : state.game === "horses" ? (
    <HorsesScreen ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
  ) : state.game === "uno" ? (
    <UnoScreen ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
  ) : state.game === "werewolf" ? (
    <WerewolfScreen ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
  ) : state.game === "roulette" ? (
    <RouletteScreen ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
  ) : (
    <>
      <BlackjackScene state={state} me={ctrl.me} />
      <BlackjackHud ctrl={ctrl} state={state} me={me} onQuit={onQuit} />
    </>
  )}
    </>
  );
}
