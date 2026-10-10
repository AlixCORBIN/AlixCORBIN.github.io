import React from "react";
import { Leaderboard } from "../games/blackjack/ui/Leaderboard.jsx";
import { START_BANKROLL, loadWallet, saveWallet } from "../lib/wallet.js";
import { GAME_INFO, watchRooms } from "../net/rooms.js";
import "../styles/rooms.css";

const GAMES = [
  { id: "blackjack", title: "Blackjack", tag: "1 à 5 joueurs", desc: "Assurance, Perfect Pairs, 21+3, double, split.", icon: "♠", hue: "#14804a" },
  { id: "roulette", title: "Roulette Européenne", tag: "Table partagée", desc: "Roue 3D, une seule bille, tous les types de mises.", icon: "◉", hue: "#a31a2a" },
  { id: "werewolf", title: "Loup-Garou", tag: "5 à 16 joueurs · bots", desc: "Village 3D jour/nuit, rôles secrets, chat de salle et de meute.", icon: "🐺", hue: "#2a3a8a", free: true },
  { id: "uno", title: "UNO 3D", tag: "2 à 10 joueurs · bots", desc: "Table 3D, règles officielles complètes : +2, +4 avec défi, UNO! et manches.", icon: "🃏", hue: "#b3202a", free: true },
  { id: "monopoly", title: "Monopoly 3D", tag: "2 à 8 joueurs · bots", desc: "Plateau Paris en 3D, enchères, échanges, maisons, hôtels.", icon: "🎩", hue: "#1f6b3a", free: true, external: "../monopoly/index.html" },
];

const PUB_KEY = "casino-public";
const loadPub = () => { try { return localStorage.getItem(PUB_KEY) !== "0"; } catch { return true; } };

function RoomsPanel({ onJoin, broke }) {
  const [rooms, setRooms] = React.useState(null);
  React.useEffect(() => watchRooms(setRooms), []);
  return (
    <aside className="rooms">
      <div className="rooms-head">
        <h2>Salles en cours</h2>
        <span className={`live ${rooms ? "ok" : ""}`}><i />{rooms ? "en direct" : "connexion…"}</span>
      </div>
      {rooms && !rooms.length && <p className="rooms-empty">Aucune salle publique pour l’instant. Crée la tienne !</p>}
      <div className="rooms-list">
        {(rooms || []).map((r) => {
          const info = GAME_INFO[r.game] || { title: r.game, icon: "🎲" };
          const full = info.max && r.players >= info.max;
          const blocked = broke && (r.game === "blackjack" || r.game === "roulette");
          return (
            <div key={r.game + r.code} className="room">
              <span className="room-icon">{info.icon}</span>
              <div className="room-main">
                <b>{info.title}</b>
                <small>
                  {r.host} · {r.players}{info.max ? `/${info.max}` : ""} joueur{r.players > 1 ? "s" : ""}
                  {r.bots ? ` + ${r.bots} bot${r.bots > 1 ? "s" : ""}` : ""}
                </small>
              </div>
              <span className={`room-status ${r.status}`}>{r.status === "lobby" ? "En attente" : "En jeu"}</span>
              <button className="btn" disabled={full || blocked} onClick={() => onJoin(r)}>{full ? "Plein" : "Rejoindre"}</button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function Lobby({ onStart }) {
  const roomParam = new URLSearchParams(location.search).get("room") || "";
  const wallet = loadWallet();
  const [name, setName] = React.useState(wallet.name || "");
  const [code, setCode] = React.useState(roomParam);
  const [showBoard, setShowBoard] = React.useState(false);
  const [bankroll, setBankroll] = React.useState(wallet.bankroll);
  const [isPublic, setIsPublic] = React.useState(loadPub);
  const pseudo = name.trim() || "Joueur";
  const togglePub = () => {
    const v = !isPublic;
    setIsPublic(v);
    try { localStorage.setItem(PUB_KEY, v ? "1" : "0"); } catch {}
  };
  const start = (game, mode, joinCode = code) => {
    saveWallet({ name: name.trim() });
    const g = GAMES.find((x) => x.id === game);
    if (g?.external) {
      const q = mode === "join" ? `room=${joinCode}&join=1` : `mode=host&public=${isPublic ? 1 : 0}`;
      location.href = `${g.external}?${q}&name=${encodeURIComponent(pseudo)}`;
      return;
    }
    onStart(game, mode, pseudo, joinCode, bankroll, { isPublic });
  };
  const [debt, setDebt] = React.useState(wallet.debt);
  const borrow = () => {
    const newDebt = debt + Math.max(0, START_BANKROLL - bankroll);
    saveWallet({ bankroll: START_BANKROLL, debt: newDebt });
    setBankroll(START_BANKROLL);
    setDebt(newDebt);
  };
  const broke = bankroll < 5;
  return (
    <div className="lobby hub with-rooms">
      <a className="back-portfolio" href="../index.html">← Portfolio</a>
      <div className="hub-card">
        <div className="logo"><span>♠</span></div>
        <h1>{"Casino "}<em>3D</em></h1>
        <p className="sub">Jetons virtuels, aucun argent réel. Solde partagé entre tous les jeux.</p>
        <div className="hub-top">
          <label>
            Ton pseudo
            <input value={name} maxLength={16} placeholder="Joueur" onChange={(ev) => setName(ev.target.value)} />
          </label>
          <div className="hub-wallet">
            <small>Ton solde</small>
            <b>{Math.round(bankroll).toLocaleString("fr-FR")}</b>
          </div>
        </div>
        {broke && (
          <button className="btn primary" style={{ width: "100%", marginBottom: 12 }} onClick={borrow}>
            {"Solde épuisé : emprunter "}{START_BANKROLL}{" jetons (déduits de ton score)"}
          </button>
        )}
        {debt > 0 && (
          <p className="hint" style={{ margin: "0 0 12px" }}>
            {"Dette : "}{debt.toLocaleString("fr-FR")}{" · Valeur nette : "}{Math.round(bankroll - debt).toLocaleString("fr-FR")}
          </p>
        )}
        <div className="pubbar">
          <button className={`switch ${isPublic ? "on" : ""}`} onClick={togglePub} aria-pressed={isPublic}><i /></button>
          <div>
            <b>{isPublic ? "Salle publique" : "Salle privée"}</b>
            <small>{isPublic ? "Visible dans « Salles en cours », tout le monde peut rejoindre." : "Invisible : seuls ceux qui ont le code peuvent rejoindre."}</small>
          </div>
        </div>
        <div className="games">
          {GAMES.map((game) => (
            <div key={game.id} className="game" style={{ "--hue": game.hue }}>
              <div className="gicon">{game.icon}</div>
              <h3>{game.title}</h3>
              <small>{game.tag}</small>
              <p>{game.desc}</p>
              <div className="row">
                <button className="btn primary" disabled={broke && !game.free} onClick={() => start(game.id, "room")}>
                  {isPublic ? "🌐 Salle publique" : "🔒 Salle privée"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="hint" style={{ margin: "-6px 0 12px" }}>Seul dans la salle, tu joues en solo ; dès qu’un ami te rejoint, c’est du multi.</p>
        <div className="join">
          <input value={code} maxLength={5} placeholder="CODE DE SALLE" onChange={(ev) => setCode(ev.target.value.toUpperCase())} />
          <button className="btn" disabled={code.trim().length < 5 || broke} onClick={() => start(null, "join")}>Rejoindre</button>
        </div>
        <button className="link" onClick={() => setShowBoard(true)}>Classement général des jetons</button>
      </div>
      <RoomsPanel broke={broke} onJoin={(r) => start(r.game, "join", r.code)} />
      {showBoard && <Leaderboard onClose={() => setShowBoard(false)} />}
    </div>
  );
}
