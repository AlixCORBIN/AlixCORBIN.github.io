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
import { ClientController, loadHostRoom } from "./net/controller.js";
import { ServerTable } from "./net/serverTable.js";
import { db } from "./lib/identity.js";
import { Lobby } from "./ui/Lobby.jsx";
import { GAME_INFO } from "./net/rooms.js";

// TrackMerdia (et son moteur physique WebAssembly) n'est chargé que quand on lance le jeu
const RacingApp = React.lazy(() => import("./games/racing/ui/RacingApp.jsx").then((m) => ({ default: m.RacingApp })));

const SERVER_GAMES = ["blackjack", "roulette"];

export function App() {
  const [ctrl, setCtrl] = React.useState(null);
  const [racing, setRacing] = React.useState(null);
  // Jeu de la salle en cours, affiché à côté du pseudo dans le chat général (rien dans les menus)
  window.__gchatGame = () => (racing ? "TrackMerdia" : ctrl?.state?.game ? GAME_INFO[ctrl.state.game]?.title || null : null);
  const start = async (game, mode, name, code, bankroll, opts = {}) => {
    if (game === "racing") return setRacing({ pseudo: name });
    // Observateur : même chemin que « rejoindre », sans prendre de place à la table
    const watch = mode === "watch";
    if (watch) mode = "join";
    // Blackjack et roulette : tables tenues par le serveur (solde, cartes et tirages côté serveur)
    if (SERVER_GAMES.includes(game) && mode !== "join") return setCtrl(new ServerTable(game, { isPublic: !!opts.isPublic, mii: opts.mii }));
    if (mode === "join") {
      let server = SERVER_GAMES.includes(game);
      if (!game) {
        const { data } = await db().rpc("casino_room_game", { p_code: String(code) });
        server = !!data;
      }
      if (server) return setCtrl(new ServerTable(game, { code: String(code).toUpperCase().trim(), mii: opts.mii, spectate: watch }));
    }
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
    const restore = mode === "resume" ? loadHostRoom() : null;
    setCtrl(
      mode === "join"
        ? new ClientController(name, code, bankroll, opts.mii, { spectate: watch })
        : new Host(restore?.name || name, {
            online: true,
            bankroll,
            game,
            isPublic: restore ? !!restore.isPublic : !!opts.isPublic,
            mii: opts.mii,
            restore,
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
