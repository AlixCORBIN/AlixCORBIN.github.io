import React from "react";
import { Leaderboard } from "../games/blackjack/ui/Leaderboard.jsx";
import { START_BANKROLL, loadWallet, saveWallet } from "../lib/wallet.js";
import { GAME_INFO, watchRooms } from "../net/rooms.js";
import { loadPlayMii } from "../lib/mii.js";
import { setCanApply } from "../lib/cloudSave.js";
import { MiiPicker } from "./MiiPicker.jsx";
import "../styles/rooms.css";
import "../styles/lobby.css";

const GAMES = [
  { id: "blackjack", cat: "casino", title: "Blackjack", players: "1 à 5", desc: "Assurance, Perfect Pairs, 21+3, double, split.", icon: "♠", hue: "#14804a" },
  { id: "roulette", cat: "casino", title: "Roulette Européenne", players: "Table partagée", desc: "Roue 3D, une seule bille, tous les types de mises.", icon: "◉", hue: "#a31a2a" },
  { id: "uno", cat: "board", title: "UNO 3D", players: "2 à 10", bots: true, desc: "Règles officielles complètes : +2, +4 avec défi, UNO! et manches.", icon: "🃏", hue: "#b3202a", free: true },
  { id: "monopoly", cat: "board", title: "Monopoly 3D", players: "2 à 8", bots: true, desc: "Plateau Paris en 3D, enchères, échanges, maisons, hôtels.", icon: "🎩", hue: "#1f6b3a", free: true, external: "../monopoly/index.html" },
  { id: "werewolf", cat: "board", title: "Loup-Garou", players: "5 à 16", bots: true, desc: "Village 3D jour/nuit, rôles secrets, chat de salle et de meute.", icon: "🐺", hue: "#2a3a8a", free: true },
  { id: "milleborne", cat: "board", title: "Mille Bornes 3D", players: "2 à 6", bots: true, desc: "Attaques, parades, bottes et coups fourrés, en équipes à 4 et 6.", icon: "🚗", hue: "#c76a12", free: true },
  { id: "horses", cat: "board", title: "Petits Chevaux", players: "2 à 4", bots: true, desc: "Sors tes 4 chevaux et rentre-les à l’écurie avant les autres.", icon: "🐴", hue: "#8a5a1f", free: true },
  { id: "naval", cat: "board", title: "Bataille navale 3D", players: "1 contre 1", bots: true, desc: "Place ta flotte, tirs animés : missiles, explosions, naufrages.", icon: "⚓", hue: "#1f5f8a", free: true },
  { id: "connect4", cat: "board", title: "Puissance 4", players: "1 contre 1", bots: true, desc: "Grille 3D, jetons qui tombent pour de vrai, manches et bot jusqu’au niveau expert.", icon: "🔴", hue: "#1d4fc4", free: true },
  { id: "buckshot", cat: "arcade", title: "Buckshot", players: "1 à 4", bots: true, desc: "Roulette au fusil à pompe : réelles ou à blanc, objets, 3 manches.", icon: "☠", hue: "#8a1030", free: true },
  { id: "racing", cat: "arcade", title: "TrackMerdia", players: "Solo", desc: "Course 3D à vraie physique : loopings, wallrides, sauts, 25 pistes, éditeur et records en ligne.", icon: "🏁", hue: "#1f4fa8", free: true, solo: true },
];

const FRIENDS = [
  { title: "Jeton", author: "Antoine Rioul", url: "https://www.antlabs.fr/jeton", icon: "🪙", hue: "#7a5a14", desc: "Clone de Stake jouable avec de faux jetons, aucun argent réel." },
  { title: "RNG World", author: "Alexandre Tricot", url: "https://rngworld.github.io/", icon: "🌍", hue: "#1f4f7a", desc: "Chaque jour, drop une ville aléatoire. Plus elle est rare, plus elle rapporte." },
];

const CATS = [
  { id: "casino", label: "Casino", note: "Misent ton solde de jetons" },
  { id: "board", label: "Société", note: "Cartes et plateaux, entre amis ou contre des bots" },
  { id: "arcade", label: "Arcade", note: "Action et réflexes" },
  { id: "friends", label: "Copains", note: "Pas faits par moi : des projets d’amis, à découvrir" },
];

const norm = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

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
              <span className={`room-status ${r.status === "lobby" ? "waiting" : r.status}`}>{r.status === "lobby" ? "En attente" : "En jeu"}</span>
              <button className="btn" disabled={full || blocked} onClick={() => onJoin(r)}>{full ? "Plein" : "Rejoindre"}</button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function GameTile({ game, broke, isPublic, onPlay }) {
  const locked = broke && !game.free;
  const action = game.solo ? "Jouer" : isPublic ? "Créer une salle publique" : "Créer une salle privée";
  return (
    <button className="tile" style={{ "--hue": game.hue }} disabled={locked} onClick={onPlay}>
      <span className="tile-icon">{game.icon}</span>
      <span className="tile-body">
        <b>{game.title}</b>
        <span className="tile-meta">
          <span>👥 {game.players}</span>
          {game.bots && <span>Bots</span>}
          {!game.free && <span className="chip-gold">Jetons</span>}
        </span>
        <span className="tile-desc">{game.desc}</span>
        <span className="tile-cta">{locked ? "Solde épuisé" : action} <i>→</i></span>
      </span>
    </button>
  );
}

function FriendTile({ game }) {
  return (
    <a className="tile friend" style={{ "--hue": game.hue }} href={game.url} target="_blank" rel="noopener">
      <span className="tile-icon">{game.icon}</span>
      <span className="tile-body">
        <b>{game.title}</b>
        <span className="tile-meta"><span>par {game.author}</span></span>
        <span className="tile-desc">{game.desc}</span>
        <span className="tile-cta">Ouvrir le site <i>↗</i></span>
      </span>
    </a>
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
  const [mii, setMii] = React.useState(loadPlayMii);
  const [cat, setCat] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const pseudo = name.trim() || mii?.name || "Joueur";
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
    onStart(game, mode, pseudo, joinCode, bankroll, { isPublic, mii });
  };
  const [debt, setDebt] = React.useState(wallet.debt);
  React.useEffect(() => {
    setCanApply(true);
    const reload = () => {
      const w = loadWallet();
      setBankroll(w.bankroll);
      setDebt(w.debt);
      setName(w.name || "");
    };
    window.addEventListener("casino-save", reload);
    return () => window.removeEventListener("casino-save", reload);
  }, []);
  const borrow = () => {
    const newDebt = debt + Math.max(0, START_BANKROLL - bankroll);
    saveWallet({ bankroll: START_BANKROLL, debt: newDebt });
    setBankroll(START_BANKROLL);
    setDebt(newDebt);
  };
  const broke = bankroll < 5;

  const q = norm(query.trim());
  const match = (g) => !q || norm(`${g.title} ${g.desc} ${g.author || ""}`).includes(q);
  const sections = CATS.filter((c) => cat === "all" || cat === c.id)
    .map((c) => ({ ...c, items: (c.id === "friends" ? FRIENDS : GAMES.filter((g) => g.cat === c.id)).filter(match) }))
    .filter((c) => c.items.length);

  return (
    <div className="casino">
      <header className="c-top">
        <a className="c-back" href="../index.html">← Portfolio</a>
        <div className="c-brand"><span>♠</span><h1>{"Casino "}<em>3D</em></h1></div>
        <div className="c-me">
          <MiiPicker value={mii} onChange={setMii} />
          <label className="c-name">
            <small>Pseudo</small>
            <input value={name} maxLength={16} placeholder={mii?.name || "Joueur"} onChange={(ev) => setName(ev.target.value)} />
          </label>
          <div className="c-wallet" title="Jetons virtuels, aucun argent réel. Solde partagé entre les jeux de casino.">
            <small>Solde</small>
            <b>{Math.round(bankroll).toLocaleString("fr-FR")}</b>
          </div>
        </div>
      </header>

      <div className="c-layout">
        <main className="c-main">
          {broke && (
            <div className="c-alert">
              <span>Solde épuisé : les jeux de casino sont bloqués.</span>
              <button className="btn primary" onClick={borrow}>Emprunter {START_BANKROLL} jetons</button>
            </div>
          )}
          {debt > 0 && (
            <p className="c-debt">
              {"Dette : "}{debt.toLocaleString("fr-FR")}{" · Valeur nette : "}{Math.round(bankroll - debt).toLocaleString("fr-FR")}
            </p>
          )}

          <div className="c-tools">
            <div className="c-tabs" role="tablist">
              {[{ id: "all", label: "Tous" }, ...CATS].map((c) => (
                <button key={c.id} role="tab" aria-selected={cat === c.id} className={cat === c.id ? "on" : ""} onClick={() => setCat(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <input className="c-search" type="search" value={query} placeholder="Rechercher un jeu…" onChange={(ev) => setQuery(ev.target.value)} />
          </div>

          {sections.map((s) => (
            <section key={s.id} className={`c-sec sec-${s.id}`}>
              <div className="c-sec-head">
                <h2>{s.label}</h2>
                <small>{s.note}</small>
              </div>
              <div className="c-grid">
                {s.id === "friends"
                  ? s.items.map((g) => <FriendTile key={g.url} game={g} />)
                  : s.items.map((g) => (
                      <GameTile key={g.id} game={g} broke={broke} isPublic={isPublic} onPlay={() => start(g.id, "room")} />
                    ))}
              </div>
            </section>
          ))}
          {!sections.length && <p className="c-empty">Aucun jeu ne correspond à « {query} ».</p>}
        </main>

        <aside className="c-side">
          <div className="c-box">
            <h2>Rejoindre un ami</h2>
            <div className="join">
              <input value={code} maxLength={5} placeholder="CODE" onChange={(ev) => setCode(ev.target.value.toUpperCase())} />
              <button className="btn primary" disabled={code.trim().length < 5 || broke} onClick={() => start(null, "join")}>Rejoindre</button>
            </div>
          </div>
          <div id="gchat-dock" className="c-box gchat-dock" />
          <div className="c-box pubbar">
            <button className={`switch ${isPublic ? "on" : ""}`} onClick={togglePub} aria-pressed={isPublic} aria-label="Salle publique"><i /></button>
            <div>
              <b>{isPublic ? "Mes salles sont publiques" : "Mes salles sont privées"}</b>
              <small>
                {isPublic ? "Tout le monde les voit dans « Salles en cours »." : "Seuls ceux qui ont le code peuvent entrer."}
                {" Seul, tu joues en solo ; dès qu’un ami arrive, c’est du multi."}
              </small>
            </div>
          </div>
          <RoomsPanel broke={broke} onJoin={(r) => start(r.game, "join", r.code)} />
          <button className="link c-board" onClick={() => setShowBoard(true)}>🏆 Classement général des jetons</button>
        </aside>
      </div>
      {showBoard && <Leaderboard onClose={() => setShowBoard(false)} />}
    </div>
  );
}
