import React from "react";
import { BlackjackHost } from "./games/blackjack/host.js";
import { BuckshotHost } from "./games/buckshot/host.js";
import { RouletteHost } from "./games/roulette/host.js";
import { UnoHost } from "./games/uno/host.js";
import { MilleBorneHost } from "./games/milleborne/host.js";
import { NavalHost } from "./games/naval/host.js";
import { Connect4Host } from "./games/connect4/host.js";
import { HorsesHost } from "./games/horses/host.js";
import { WerewolfHost } from "./games/werewolf/host.js";
import { GameScreen } from "./GameScreen.jsx";
import { ClientController } from "./net/controller.js";
import { Lobby } from "./ui/Lobby.jsx";

// TrackMerdia (et son moteur physique WebAssembly) n'est chargé que quand on lance le jeu
const RacingApp = React.lazy(() => import("./games/racing/ui/RacingApp.jsx").then((m) => ({ default: m.RacingApp })));

export function App() {
  const [ctrl, setCtrl] = React.useState(null);
  const [racing, setRacing] = React.useState(null);
  const start = (game, mode, name, code, bankroll, opts = {}) => {
    if (game === "racing") return setRacing({ pseudo: name });
    const Host =
      game === "buckshot"
        ? BuckshotHost
        : game === "roulette"
        ? RouletteHost
        : game === "werewolf"
          ? WerewolfHost
          : game === "uno"
            ? UnoHost
            : game === "milleborne"
              ? MilleBorneHost
              : game === "naval"
              ? NavalHost
              : game === "connect4"
              ? Connect4Host
              : game === "horses"
                ? HorsesHost
                : BlackjackHost;
    setCtrl(
      mode === "join"
        ? new ClientController(name, code, bankroll, opts.mii)
        : new Host(name, {
            online: true,
            bankroll,
            game,
            isPublic: !!opts.isPublic,
            mii: opts.mii,
          }),
    );
  };
  const quit = () => {
    ctrl?.destroy();
    setCtrl(null);
    history.replaceState(null, "", location.pathname);
  };
  if (racing)
    return (
      <React.Suspense fallback={<div className="center-screen"><div className="panel"><div className="spinner" /><p>Chargement…</p></div></div>}>
        <RacingApp pseudo={racing.pseudo} onQuit={() => setRacing(null)} />
      </React.Suspense>
    );
  return ctrl ? (
    <GameScreen ctrl={ctrl} onQuit={quit} />
  ) : (
    <Lobby onStart={start} />
  );
}
