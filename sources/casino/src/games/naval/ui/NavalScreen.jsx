import React from "react";
import { FLEET, SIZE, TURN_CHOICES, cellName, fleetError, randomFleet, shipCells } from "../engine.js";
import { NavalScene } from "../three/NavalScene.jsx";
import { sfx, startAmbience, stopAmbience } from "../sfx.js";
import { sound } from "../../../lib/sound.js";
import "./naval.css";

import { AdminName } from "../../../lib/admins.js";
const shipName = (k) => FLEET.find((f) => f.k === k)?.name || k;

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

function Header({ ctrl, state, onQuit, left }) {
  const [copied, setCopied] = React.useState(false);
  const [muted, setMuted] = React.useState(sound.isMuted());
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${ctrl.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const toggle = () => {
    const m = sound.toggle();
    setMuted(m);
    if (!m) startAmbience();
  };
  return (
    <header className="topbar">
      <div className="brand">⚓ Bataille navale</div>
      {ctrl.code && (
        <button className="pill" onClick={copy} title="Copier le lien d'invitation">
          Salle <b>{ctrl.code}</b> · {copied ? "copié !" : "copier le lien"}
        </button>
      )}
      <div className="grow" />
      {left !== null && (state.phase === "placing" || state.step === "aim") && (
        <div className="pill nv-timer">
          <b className={left <= 8 ? "hurry" : ""}>{left}s</b>
        </div>
      )}
      <button className="icon" onClick={toggle} title="Son">
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
  const s = state.settings;
  const set = (patch) => ctrl.act({ t: "settings", patch });
  const n = state.players.length;
  return (
    <div className="nv-panel panel">
      <h2>⚓ Bataille navale</h2>
      <p className="sub">
        Duel 1 contre 1 · seul, tu affrontes un bot
        {ctrl.code ? " · partage le code de salle pour défier un ami" : ""}
      </p>
      <div className="nv-plist">
        {state.players.map((p) => (
          <div key={p.id} className={"nv-pl" + (p.id === me.id ? " me" : "")}>
            <span>
              {p.id === state.hostId ? "👑 " : ""}
              <AdminName name={p.name} id={p.id} />
            </span>
            <em>{p.bot ? "bot" : "prêt"}</em>
          </div>
        ))}
        {n < 2 && (
          <div className="nv-pl empty">
            <span>En attente d'un adversaire…</span>
            <em>bot sinon</em>
          </div>
        )}
      </div>
      {host ? (
        <>
          <div className="nv-settings">
            <label className="nv-opt">
              <span>Temps par tir</span>
              <select value={s.turnMs} onChange={(e) => set({ turnMs: +e.target.value })}>
                {TURN_CHOICES.map((t) => (
                  <option key={t} value={t}>
                    {t === 0 ? "illimité" : `${t / 1000} s`}
                  </option>
                ))}
              </select>
            </label>
            <button className={"nv-tg" + (s.bonus ? " on" : "")} onClick={() => set({ bonus: !s.bonus })}>
              Rejouer après un touché : {s.bonus ? "oui" : "non"}
            </button>
            <button className={"nv-tg" + (!s.touch ? " on" : "")} onClick={() => set({ touch: !s.touch })}>
              Navires collés interdits : {s.touch ? "non" : "oui"}
            </button>
          </div>
          <div className="row">
            {n === 2 && state.players.some((p) => p.bot) && (
              <button className="btn ghost" onClick={() => ctrl.act({ t: "removeBot" })}>
                Retirer le bot
              </button>
            )}
            <button className="btn primary" onClick={() => ctrl.act({ t: "start" })}>
              {n < 2 ? "Jouer contre un bot" : "Lancer la bataille"}
            </button>
          </div>
        </>
      ) : (
        <p className="hint">L'hôte lance la bataille.</p>
      )}
    </div>
  );
}

/* ---------- placement de la flotte ---------- */

function usePlacement(state, me, ctrl) {
  const touch = state.settings.touch;
  const [ships, setShips] = React.useState([]);
  const [sel, setSel] = React.useState(FLEET[0].k);
  const [dir, setDir] = React.useState("h");
  const [hover, setHover] = React.useState(null);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => {
    if (state.phase === "placing" && !me.ready && me.ships?.length) setShips(me.ships.map(({ hits, ...s }) => s));
  }, [state.phase, me.ready]);
  React.useEffect(() => {
    if (state.phase !== "placing") {
      setShips([]);
      setSel(FLEET[0].k);
    }
  }, [state.phase, state.round]);

  const nextFree = (list) => FLEET.find((f) => !list.some((s) => s.k === f.k))?.k || null;
  const ghostAt = (x, y, k = sel, d = dir) => {
    if (!k || x == null) return null;
    const len = FLEET.find((f) => f.k === k).len;
    return {
      k,
      len,
      dir: d,
      x: d === "h" ? Math.min(x, SIZE - len) : x,
      y: d === "v" ? Math.min(y, SIZE - len) : y,
    };
  };
  const ghost = hover && !me.ready ? ghostAt(hover[0], hover[1]) : null;
  const flash = (m) => {
    setErr(m);
    setTimeout(() => setErr(null), 1800);
  };
  const rotate = () => {
    setDir((d) => (d === "h" ? "v" : "h"));
    sfx.rotate();
  };
  const onCell = (x, y) => {
    if (me.ready) return;
    const there = ships.find((s) => shipCells(s).some(([cx, cy]) => cx === x && cy === y));
    if (sel) {
      const g = ghostAt(x, y);
      const e = fleetError([...ships, g], { partial: true, touch });
      if (!e) {
        const list = [...ships, g];
        setShips(list);
        setSel(nextFree(list));
        sfx.place();
      } else if (there) {
        pick(there);
      } else flash(e === "navires superposés" ? "Il y a déjà un navire ici" : e[0].toUpperCase() + e.slice(1));
    } else if (there) pick(there);
  };
  const pick = (s) => {
    setShips((list) => list.filter((o) => o.k !== s.k));
    setSel(s.k);
    setDir(s.dir);
    sfx.rotate();
  };
  const random = () => {
    const f = randomFleet(touch);
    if (f) {
      setShips(f);
      setSel(null);
      sfx.place();
    }
  };
  const clear = () => {
    setShips([]);
    setSel(FLEET[0].k);
  };
  const ready = () => ctrl.act({ t: "place", ships });

  React.useEffect(() => {
    if (state.phase !== "placing") return;
    const onKey = (e) => {
      if (e.key === "r" || e.key === "R" || e.key === " ") {
        e.preventDefault();
        rotate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase]);

  return {
    ships,
    sel,
    setSel,
    dir,
    rotate,
    random,
    clear,
    ready,
    err,
    scene: {
      ships,
      ghost,
      onHover: (x, y) => setHover(x == null ? null : [x, y]),
      onCell,
      onRotate: rotate,
    },
  };
}

function PlacementDock({ pl, state, me, ctrl }) {
  if (me.ready) {
    const waiting = state.players.filter((p) => !p.ready);
    return (
      <div className="dock nv-dock">
        <p>
          Flotte déployée ✔ {waiting.length ? `En attente de ${waiting.map((p) => p.name).join(", ")}…` : ""}
        </p>
        <button className="btn ghost" onClick={() => ctrl.act({ t: "unready" })}>
          Modifier
        </button>
      </div>
    );
  }
  return (
    <div className="dock nv-dock nv-place">
      <div className="nv-fleet-pick">
        {FLEET.map((f) => {
          const placed = pl.ships.some((s) => s.k === f.k);
          return (
            <button key={f.k} className={"nv-ship" + (pl.sel === f.k ? " sel" : "") + (placed ? " placed" : "")} onClick={() => !placed && pl.setSel(f.k)}>
              <span className="nv-pips">{"▮".repeat(f.len)}</span>
              <AdminName name={f.name} id={f.id} />
            </button>
          );
        })}
      </div>
      <p className="hint">
        {pl.sel ? "Clique sur ta grille pour poser le navire · R ou clic droit pour pivoter" : "Clique un navire posé pour le déplacer"}
      </p>
      <div className="row">
        <button className="btn ghost" onClick={pl.rotate}>
          ⟳ {pl.dir === "h" ? "Horizontal" : "Vertical"}
        </button>
        <button className="btn ghost" onClick={pl.random}>
          🎲 Aléatoire
        </button>
        <button className="btn ghost" onClick={pl.clear} disabled={!pl.ships.length}>
          Effacer
        </button>
        <button className="btn primary" onClick={pl.ready} disabled={pl.ships.length !== FLEET.length}>
          Prêt au combat
        </button>
      </div>
    </div>
  );
}

/* ---------- combat ---------- */

function FleetCard({ p, title, side, mine }) {
  const acc = p.fired ? Math.round((p.hits / p.fired) * 100) : 0;
  return (
    <div className={"nv-fleet " + side}>
      <b>{title}</b>
      {FLEET.map((f) => {
        const sunk = p.sunk.includes(f.k);
        const ship = mine ? p.ships?.find((s) => s.k === f.k) : null;
        return (
          <div key={f.k} className={"nv-row" + (sunk ? " sunk" : "")}>
            <span className="nv-pips">
              {Array.from({ length: f.len }, (_, i) => (
                <i key={i} className={sunk || (ship && i < ship.hits) ? "hit" : ""} />
              ))}
            </span>
            <small><AdminName name={f.name} id={f.id} /></small>
          </div>
        );
      })}
      <small className="nv-acc">
        {p.fired} tir{p.fired > 1 ? "s" : ""} · {acc}% de précision
      </small>
    </div>
  );
}

function Banner({ state, me }) {
  const shot = state.shot;
  const shooter = state.players.find((p) => p.id === (shot?.by || state.turn));
  if (state.step === "impact" && shot) {
    const cls = shot.sunk ? "sunk" : shot.hit ? "hit" : "miss";
    const txt = shot.sunk ? `☠ Coulé ! ${shipName(shot.sunk)}` : shot.hit ? "💥 Touché !" : "🌊 À l'eau…";
    return (
      <div key={"i" + shot.seq} className={"nv-impact " + cls}>
        {txt}
        <small>
          {shooter?.name} · {cellName(shot.x, shot.y)}
        </small>
      </div>
    );
  }
  if (state.step === "flying" && shot) {
    return (
      <div key={"f" + shot.seq} className="nv-banner">
        🚀 {shot.by === me.id ? "Missile lancé" : `${shooter?.name} tire`} sur {cellName(shot.x, shot.y)}…
      </div>
    );
  }
  return state.turn === me.id && !me.spectator ? (
    <div key={"a" + state.turn + (shot?.seq || 0)} className="nv-banner mine">
      🎯 À toi de tirer ! Vise une case de la grille ennemie
    </div>
  ) : (
    <div key={"w" + state.turn + (shot?.seq || 0)} className="nv-banner">
      🔭 {shooter?.name} vise {me.spectator ? `la flotte de ${state.players.find((p) => p.id !== state.turn)?.name || "l'adversaire"}` : "ta flotte"}…
    </div>
  );
}

function Log({ log }) {
  return (
    <div className="nv-log">
      {log.slice(-8).map((l) => (
        <p key={l.id} className={l.tone}>
          {l.text}
        </p>
      ))}
    </div>
  );
}

function EndPanel({ ctrl, state, me }) {
  const won = state.winner === me.id;
  const winner = state.players.find((p) => p.id === state.winner);
  return (
    <div className="nv-panel panel nv-end">
      <h2>{won ? "🏆 Victoire !" : `⚓ ${winner?.name} gagne la bataille`}</h2>
      {!me.spectator && <p className="sub">{won ? "Toute la flotte ennemie repose au fond de l'océan." : "Ta flotte a sombré… revanche ?"}</p>}
      <div className="nv-endstats">
        {state.players.map((p) => (
          <div key={p.id} className={p.id === state.winner ? "won" : ""}>
            <b>
              {p.bot ? "🤖 " : ""}
              <AdminName name={p.name} id={p.id} />
            </b>
            <span>
              {p.fired} tirs · {p.hits} touchés · {p.fired ? Math.round((p.hits / p.fired) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
      {state.hostId === me.id ? (
        <button className="btn primary" onClick={() => ctrl.act({ t: "restart" })}>
          Nouvelle bataille
        </button>
      ) : (
        <p className="hint">L'hôte peut relancer une bataille.</p>
      )}
    </div>
  );
}

export function NavalScreen({ ctrl, state, me, onQuit }) {
  if (import.meta.env.DEV) window.__navalCtrl = ctrl;
  const left = useCountdown(state.deadline);
  const [aim, setAim] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const pl = usePlacement(state, me, ctrl);
  const foe = state.players.find((p) => p.id !== me.id);
  const prev = React.useRef({});

  React.useEffect(() => {
    startAmbience();
    return () => stopAmbience();
  }, []);

  // Bruitages, déclenchés par les changements d'étape (identiques chez tous les joueurs).
  React.useEffect(() => {
    const last = prev.current;
    const seq = state.shot?.seq;
    if (state.phase !== last.phase && (state.phase === "placing" || state.phase === "battle")) sfx.horn();
    if (state.phase === "battle") {
      if (state.step === "flying" && last.flying !== seq) {
        sfx.launch();
        sfx.whistle(1.7);
      }
      if (state.step === "impact" && last.impact !== seq) {
        if (state.shot.hit) {
          sfx.explosion();
          if (state.shot.sunk) sfx.sink();
        } else sfx.splash();
      }
      if (state.step === "aim" && state.turn === me.id && (last.step !== "aim" || last.turn !== me.id || last.phase !== "battle")) setTimeout(() => sfx.ping(), 500);
    }
    if (state.phase === "end" && last.phase !== "end") setTimeout(() => (state.winner === me.id ? sound.win : sound.lose)(), 900);
    prev.current = {
      phase: state.phase,
      step: state.step,
      turn: state.turn,
      flying: state.step === "flying" ? seq : last.flying,
      impact: state.step === "impact" ? seq : last.impact,
    };
  });

  React.useEffect(() => {
    if (!ctrl.lastError) return;
    setErr(ctrl.lastError);
    const t = setTimeout(() => setErr(null), 2200);
    return () => clearTimeout(t);
  }, [ctrl.lastError, ctrl.getSnapshot()]);

  const lastAim = React.useRef(null);
  const onAim = (c) => {
    if (c && c !== lastAim.current) sfx.hover();
    lastAim.current = c;
    setAim(c);
  };
  const onFire = (x, y) => {
    if (foe?.shots.some((s) => s.x === x && s.y === y)) return setErr("Case déjà visée");
    setAim(null);
    ctrl.act({ t: "fire", x, y });
  };

  const placing = state.phase === "placing";
  const battle = state.phase === "battle";

  return (
    <div className="nv-root">
      <NavalScene state={state} meId={me.id} spectator={!!me.spectator} placing={placing ? pl.scene : null} aim={aim} onAim={onAim} onFire={onFire} />
      <Header ctrl={ctrl} state={state} onQuit={onQuit} left={left} />
      {state.phase === "lobby" && <Lobby ctrl={ctrl} state={state} me={me} />}
      {placing && (
        <>
          <div className="nv-banner mine">⚓ Déploie ta flotte</div>
          <div className="nv-bottom">
            {(pl.err || err) && <div className="toast">{pl.err || err}</div>}
            <PlacementDock pl={pl} state={state} me={me} ctrl={ctrl} />
          </div>
        </>
      )}
      {battle && (
        <>
          <Banner state={state} me={me} />
          <FleetCard p={me} title={me.spectator ? `Flotte de ${me.name}` : "Ta flotte"} side="left" mine />
          {foe && <FleetCard p={foe} title={`Flotte de ${foe.name}`} side="right" />}
          <Log log={state.log} />
          {err && (
            <div className="nv-bottom">
              <div className="toast">{err}</div>
            </div>
          )}
        </>
      )}
      {state.phase === "end" && <EndPanel ctrl={ctrl} state={state} me={me} />}
    </div>
  );
}
