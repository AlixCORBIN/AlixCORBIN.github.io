import React from "react";
import { COLOR_HEX, COLOR_NAME, TURN_CHOICES } from "../engine.js";
import { HorsesScene } from "../three/HorsesScene.jsx";
import { sound } from "../../../lib/sound.js";
import "./horses.css";

function useCountdown(deadline) {
  const [left, setLeft] = React.useState(null);
  React.useEffect(() => {
    if (!deadline) return setLeft(null);
    const end = Date.now() + deadline.ms;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

function Header({ ctrl, onQuit, left }) {
  const [copied, setCopied] = React.useState(false);
  const [muted, setMuted] = React.useState(sound.isMuted());
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${ctrl.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <header className="topbar">
      <div className="brand">🐴 Petits Chevaux</div>
      {ctrl.code && (
        <button className="pill" onClick={copy} title="Copier le lien d'invitation">
          Salle <b>{ctrl.code}</b> · {copied ? "copié !" : "copier le lien"}
        </button>
      )}
      <div className="grow" />
      {left !== null && <div className={"pill" + (left <= 5 ? " hc-hurry" : "")}>{left}s</div>}
      <button className="icon" onClick={() => setMuted(sound.toggle())} title="Son">
        {muted ? "🔇" : "🔊"}
      </button>
      <button className="icon" onClick={onQuit} title="Quitter">
        ✕
      </button>
    </header>
  );
}

function Lobby({ ctrl, state, me }) {
  const host = state.hostId === me.id;
  const n = state.players.length;
  return (
    <div className="hc-panel panel">
      <h2>Petits Chevaux</h2>
      <p className="sub">
        {n}/4 joueurs · complété par des bots si tu es seul
        {ctrl.code ? " · partage le code de salle pour inviter" : ""}
      </p>
      <div className="hc-plist">
        {state.players.map((p) => (
          <div key={p.id} className={"hc-pl" + (p.id === me.id ? " me" : "")} style={{ "--c": COLOR_HEX[p.color] }}>
            <i />
            <span>
              {p.id === state.hostId ? "👑 " : ""}
              {p.name}
            </span>
            <em>{p.bot ? "bot" : COLOR_NAME[p.color]}</em>
          </div>
        ))}
      </div>
      <ul className="hc-rules">
        <li>Un <b>6</b> pour sortir un cheval de l'écurie, et un 6 fait rejouer (trois 6 d'affilée : tour perdu).</li>
        <li>Tomber sur un adversaire le renvoie à l'écurie.</li>
        <li>Il faut s'arrêter <b>pile</b> devant son échelle, puis faire 1, 2, 3, 4, 5 et enfin 6 pour atteindre le centre.</li>
        <li>Le premier à rentrer ses 4 chevaux gagne.</li>
      </ul>
      {host ? (
        <>
          <label className="hc-opt">
            <span>Temps par action</span>
            <select value={state.settings.turnMs} onChange={(e) => ctrl.act({ t: "settings", patch: { turnMs: +e.target.value } })}>
              {TURN_CHOICES.map((t) => (
                <option key={t} value={t}>
                  {t === 0 ? "illimité" : `${t / 1000} s`}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <button className="btn ghost" disabled={n >= 4} onClick={() => ctrl.act({ t: "addBot" })}>
              + Bot
            </button>
            <button className="btn ghost" disabled={!state.players.some((p) => p.bot)} onClick={() => ctrl.act({ t: "removeBot" })}>
              − Bot
            </button>
            <button className="btn primary" onClick={() => ctrl.act({ t: "start" })}>
              Lancer la partie
            </button>
          </div>
        </>
      ) : (
        <p className="hint">L'hôte lance la partie quand tout le monde est là.</p>
      )}
    </div>
  );
}

function Dock({ ctrl, state, me }) {
  const cur = state.players.find((p) => p.id === state.turnId);
  const mine = cur?.id === me.id;
  let body;
  if (state.stage === "roll" && mine) {
    body = (
      <div className="row">
        <p className="grow">À toi ! Lance le dé.</p>
        <button className="btn act hit hc-roll" onClick={() => ctrl.act({ t: "roll" })}>
          🎲 Lancer
        </button>
      </div>
    );
  } else if (state.stage === "rolling") body = <p>{mine ? "Le dé roule…" : `${cur?.name} lance le dé…`}</p>;
  else if (state.stage === "choose" && mine)
    body = (
      <p>
        Tu as fait <b className="hc-v">{state.die.v}</b> : clique sur un cheval qui brille.
      </p>
    );
  else if (state.stage === "choose") body = <p>{cur?.name} a fait {state.die.v} et choisit un cheval…</p>;
  else if (state.stage === "moving") body = <p>{cur?.name} avance…</p>;
  else if (state.stage === "pass") body = <p>{cur?.name} ne peut pas jouer.</p>;
  else body = <p>Tour de {cur?.name}…</p>;
  const hot = mine && (state.stage === "roll" || state.stage === "choose");
  return (
    <div className={"dock hc-dock" + (hot ? " mine" : " slim")} style={{ "--c": COLOR_HEX[cur?.color] }}>
      {body}
    </div>
  );
}

function End({ ctrl, state, me }) {
  const w = state.players.find((p) => p.id === state.winner);
  const host = state.hostId === me.id;
  return (
    <div className="hc-panel panel hc-end">
      <h2>🏆 {w?.name} gagne !</h2>
      <div className="hc-plist">
        {state.ranking.map((id, i) => {
          const p = state.players.find((x) => x.id === id);
          if (!p) return null;
          return (
            <div key={id} className={"hc-pl" + (id === me.id ? " me" : "")} style={{ "--c": COLOR_HEX[p.color] }}>
              <i />
              <span>
                {i + 1}. {p.name}
              </span>
              <em>
                {p.horses.filter((x) => x === 56).length}/4 · {p.captures} 💥
              </em>
            </div>
          );
        })}
      </div>
      {host ? (
        <button className="btn primary" onClick={() => ctrl.act({ t: "restart" })}>
          Rejouer
        </button>
      ) : (
        <p className="hint">L'hôte peut relancer une partie.</p>
      )}
    </div>
  );
}

function Log({ log }) {
  return (
    <div className="hc-log">
      {log.slice(-8).map((l) => (
        <p key={l.id} className={l.tone}>
          {l.text}
        </p>
      ))}
    </div>
  );
}

export function HorsesScreen({ ctrl, state, me, onQuit }) {
  if (import.meta.env.DEV) window.__horsesCtrl = ctrl;
  const left = useCountdown(state.deadline);
  const prev = React.useRef({});
  React.useEffect(() => {
    const last = prev.current;
    if (state.phase === "playing" && state.turnId === me.id && state.stage === "roll" && last.key !== state.turnId + state.die?.seq) sound.turn();
    if (state.phase === "end" && last.phase !== "end") (state.winner === me.id ? sound.fanfare : sound.lose)();
    prev.current = { key: state.stage === "roll" ? state.turnId + state.die?.seq : last.key, phase: state.phase };
  });
  return (
    <div className="hc-root">
      <HorsesScene state={state} meId={me.id} onPick={(h) => ctrl.act({ t: "move", horse: h })} />
      <Header ctrl={ctrl} onQuit={onQuit} left={state.phase === "playing" ? left : null} />
      {state.phase === "lobby" && <Lobby ctrl={ctrl} state={state} me={me} />}
      {state.phase === "playing" && (
        <>
          <Log log={state.log} />
          <div className="hc-bottom">
            <Dock ctrl={ctrl} state={state} me={me} />
          </div>
        </>
      )}
      {state.phase === "end" && <End ctrl={ctrl} state={state} me={me} />}
    </div>
  );
}
