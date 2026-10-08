import React from "react";
import { Leaderboard } from "../games/blackjack/ui/Leaderboard.jsx";
import { START_BANKROLL, loadWallet, saveWallet } from "../lib/wallet.js";

const GAMES = [
  {
    id: "blackjack",
    title: "Blackjack",
    tag: "1 à 5 joueurs",
    desc: "Assurance, Perfect Pairs, 21+3, double, split.",
    icon: "♠",
    hue: "#14804a",
  },
  {
    id: "roulette",
    title: "Roulette Européenne",
    tag: "Table partagée",
    desc: "Roue 3D, une seule bille, tous les types de mises.",
    icon: "◉",
    hue: "#a31a2a",
  },
];

export function Lobby({ onStart }) {
  const roomParam = new URLSearchParams(location.search).get("room") || "";
  const wallet = loadWallet();
  const [name, setName] = React.useState(wallet.name || "");
  const [code, setCode] = React.useState(roomParam);
  const [showBoard, setShowBoard] = React.useState(false);
  const [bankroll, setBankroll] = React.useState(wallet.bankroll);
  const pseudo = name.trim() || "Joueur";
  const start = (game, mode) => {
    saveWallet({
      name: name.trim(),
    });
    onStart(game, mode, pseudo, code, bankroll);
  };
  const [debt, setDebt] = React.useState(wallet.debt);
  const borrow = () => {
    const newDebt = debt + Math.max(0, START_BANKROLL - bankroll);
    saveWallet({
      bankroll: START_BANKROLL,
      debt: newDebt,
    });
    setBankroll(START_BANKROLL);
    setDebt(newDebt);
  };
  const broke = bankroll < 5;
  return (
    <div className="lobby hub">
      <div className="hub-card">
        <div className="logo">
          <span>♠</span>
        </div>
        <h1>
          {"Casino "}
          <em>3D</em>
        </h1>
        <p className="sub">
          Jetons virtuels, aucun argent réel. Solde partagé entre tous les jeux.
        </p>
        <div className="hub-top">
          <label>
            Ton pseudo
            <input
              value={name}
              maxLength={16}
              placeholder="Joueur"
              onChange={(ev) => setName(ev.target.value)}
            />
          </label>
          <div className="hub-wallet">
            <small>Ton solde</small>
            <b>{Math.round(bankroll).toLocaleString("fr-FR")}</b>
          </div>
        </div>
        {broke && (
          <button
            className="btn primary"
            style={{
              width: "100%",
              marginBottom: 12,
            }}
            onClick={borrow}
          >
            {"Solde épuisé : emprunter "}
            {START_BANKROLL}
            {" jetons (déduits de ton score)"}
          </button>
        )}
        {debt > 0 && (
          <p
            className="hint"
            style={{
              margin: "0 0 12px",
            }}
          >
            {"Dette : "}
            {debt.toLocaleString("fr-FR")}
            {" · Valeur nette : "}
            {Math.round(bankroll - debt).toLocaleString("fr-FR")}
          </p>
        )}
        <div className="games">
          {GAMES.map((game) => (
            <div
              key={game.id}
              className="game"
              style={{
                "--hue": game.hue,
              }}
            >
              <div className="gicon">{game.icon}</div>
              <h3>{game.title}</h3>
              <small>{game.tag}</small>
              <p>{game.desc}</p>
              <div className="row">
                <button
                  className="btn primary"
                  disabled={broke}
                  onClick={() => start(game.id, "solo")}
                >
                  Solo
                </button>
                <button
                  className="btn"
                  disabled={broke}
                  onClick={() => start(game.id, "host")}
                >
                  Créer une salle
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="join">
          <input
            value={code}
            maxLength={5}
            placeholder="CODE DE SALLE"
            onChange={(ev) => setCode(ev.target.value.toUpperCase())}
          />
          <button
            className="btn"
            disabled={code.trim().length < 5 || broke}
            onClick={() => start(null, "join")}
          >
            Rejoindre
          </button>
        </div>
        <button className="link" onClick={() => setShowBoard(true)}>
          Classement du blackjack
        </button>
      </div>
      {showBoard && <Leaderboard onClose={() => setShowBoard(false)} />}
    </div>
  );
}
