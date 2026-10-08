import React from "react";
import { BlackjackHost } from "./games/blackjack/host.js";
import { RouletteHost } from "./games/roulette/host.js";
import { WerewolfHost } from "./games/werewolf/host.js";
import { GameScreen } from "./GameScreen.jsx";
import { ClientController } from "./net/controller.js";
import { Lobby } from "./ui/Lobby.jsx";

export function App() {
  const [ctrl, setCtrl] = React.useState(null);
  const start = (game, mode, name, code, bankroll) => {
    const Host =
      game === "roulette" ? RouletteHost : game === "werewolf" ? WerewolfHost : BlackjackHost;
    setCtrl(
      mode === "solo"
        ? new Host(name, {
            bankroll,
          })
        : mode === "host"
          ? new Host(name, {
              online: true,
              bankroll,
            })
          : new ClientController(name, code, bankroll),
    );
  };
  const quit = () => {
    ctrl?.destroy();
    setCtrl(null);
    history.replaceState(null, "", location.pathname);
  };
  return ctrl ? (
    <GameScreen ctrl={ctrl} onQuit={quit} />
  ) : (
    <Lobby onStart={start} />
  );
}
