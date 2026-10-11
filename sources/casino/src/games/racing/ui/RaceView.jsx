import React from "react";
import { fetchGhost, leaderboard, localPB, submitTime } from "../api.js";
import { engine, sfx, stopEngine } from "../audio.js";
import { bindKeys, touch } from "../input.js";
import { medalFor, medalTimes } from "../maps.js";
import { WORLDS, formatTime, initPhysics } from "../physics.js";
import { RaceSession } from "../session.js";
import { Track } from "../track.js";
import { RaceScene } from "../three/RaceScene.jsx";
import { Board } from "./Board.jsx";

const CAR_KEY = "racing-car";
export const CAR_COLORS = ["#e63946", "#1f6fe0", "#ffb400", "#18a04a", "#9b4dff", "#f2f2f2", "#ff5fa2", "#202228"];
export const loadCarColor = () => { try { return localStorage.getItem(CAR_KEY) || CAR_COLORS[0]; } catch { return CAR_COLORS[0]; } };
export const saveCarColor = (c) => { try { localStorage.setItem(CAR_KEY, c); } catch {} };

const delta = (ms) => `${ms < 0 ? "-" : "+"}${formatTime(Math.abs(ms)).replace(/^0:0?/, "")}`;

function TouchPad() {
  const bind = (k) => ({
    onPointerDown: (e) => { e.preventDefault(); touch[k] = true; },
    onPointerUp: () => { touch[k] = false; },
    onPointerLeave: () => { touch[k] = false; },
    onPointerCancel: () => { touch[k] = false; },
  });
  return (
    <div className="rc-touch">
      <div className="rc-touch-l">
        <button {...bind("left")}>◀</button>
        <button {...bind("right")}>▶</button>
      </div>
      <div className="rc-touch-r">
        <button {...bind("drift")} className="sm">Dérapage</button>
        <button {...bind("down")}>▼</button>
        <button {...bind("up")} className="gas">▲</button>
      </div>
    </div>
  );
}

// La physique (WebAssembly) se charge une fois avant la première course
export function RaceView(props) {
  const [ready, setReady] = React.useState(false);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => { initPhysics().then(() => setReady(true), (e) => setErr(e.message)); }, []);
  if (!ready) {
    return (
      <div className="center-screen">
        <div className="panel">{err ? <p className="err">{err}</p> : <><div className="spinner" /><p>Chargement de la physique…</p></>}</div>
      </div>
    );
  }
  return <RaceViewInner {...props} />;
}

function RaceViewInner({ map, pseudo, mode = "play", onExit, onNext, onTestDone }) {
  const track = React.useMemo(() => new Track(map.data), [map]);
  const world = WORLDS[map.data.world ?? map.world ?? 0] || WORLDS[0];
  const [color] = React.useState(loadCarColor);
  const [result, setResult] = React.useState(null);
  const [flash, setFlash] = React.useState(null);
  const [count, setCount] = React.useState(3);
  const [ghosts, setGhosts] = React.useState([]);
  const [showGhosts, setShowGhosts] = React.useState(true);
  const [board, setBoard] = React.useState(false);
  const [pb, setPb] = React.useState(() => (mode === "play" ? localPB(map.id) : null));
  const pbRef = React.useRef(pb);
  pbRef.current = pb;
  const isTouch = React.useMemo(() => matchMedia("(pointer: coarse)").matches, []);

  const flashMsg = React.useRef(0);
  const showFlash = (f) => {
    setFlash(f);
    const id = ++flashMsg.current;
    setTimeout(() => flashMsg.current === id && setFlash(null), 2200);
  };

  const session = React.useMemo(() => {
    const s = new RaceSession(track, world, {
      onEvent: (e) => {
        if (e === "tick") { sfx.tick(); setCount((c) => Math.max(1, c - 1)); }
        if (e === "go") { sfx.go(); setCount(0); setTimeout(() => setCount((c) => (c === 0 ? -1 : c)), 800); }
        if (e === "restart") { sfx.tick(); setCount(3); setResult(null); setFlash(null); }
        if (e === "boost") sfx.boost();
        if (e === "respawn") sfx.respawn();
        if (e === "missing") { sfx.missing(); showFlash({ text: "Checkpoints manquants !", bad: true }); }
        if (e === "cp") {
          sfx.cp();
          const i = s.run.splits.length - 1;
          const ref = pbRef.current?.splits?.[i];
          const t = s.run.splits[i];
          showFlash({ text: formatTime(t), sub: ref != null ? delta(t - ref) : null, bad: ref != null && t > ref });
        }
      },
      onFinish: (ms, ghost, splits) => {
        sfx.finish();
        const prev = pbRef.current;
        const r = { ms, prev: prev?.ms ?? null, medal: medalFor(ms, map.author_time), saving: mode === "play", rank: null, pbNew: !prev || ms < prev.ms };
        setResult(r);
        if (mode === "test") { onTestDone?.(ms); return; }
        if (r.pbNew) setPb({ ms, ghost, splits });
        submitTime(map.id, pseudo, ms, ghost, splits).then(({ rank }) => setResult((x) => x && x.ms === ms ? { ...x, rank, saving: false } : x)).catch(() => setResult((x) => x && { ...x, saving: false }));
      },
    });
    return s;
  }, [track, world]);

  // Fantômes : record perso (local) + record du monde
  React.useEffect(() => {
    if (mode !== "play") return;
    let alive = true;
    (async () => {
      try {
        const top = await leaderboard(map.id, 1);
        const wr = top[0];
        if (wr && wr.pseudo !== pseudo) {
          const g = await fetchGhost(map.id, wr.pseudo);
          if (alive && g) setGhosts((list) => [...list.filter((x) => x.key !== "wr"), { key: "wr", label: `Record · ${wr.pseudo}`, data: g, color: "#ffd23f" }]);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [map.id]);
  const allGhosts = React.useMemo(() => {
    const list = [...ghosts];
    if (pb?.ghost) list.push({ key: "pb", label: "Ton record", data: pb.ghost, color: "#7fd1ff" });
    return list;
  }, [ghosts, pb]);

  React.useEffect(() => bindKeys({
    onRestart: () => session.restart(),
    onRespawn: () => session.respawnCp(),
    onEscape: () => onExit(),
  }), [session]);
  React.useEffect(() => () => { stopEngine(); session.dispose(); }, [session]);

  // HUD mis à jour à chaque image sans passer par React
  const timeEl = React.useRef(), speedEl = React.useRef(), cpEl = React.useRef(), boostEl = React.useRef();
  const hudRef = React.useRef((s, car) => {
    if (timeEl.current) timeEl.current.textContent = formatTime(s.phase === "countdown" ? 0 : s.timeMs);
    if (speedEl.current) speedEl.current.textContent = String(car.kmh);
    if (cpEl.current) cpEl.current.textContent = `${s.run.cps.size}/${s.track.cps.length}`;
    if (boostEl.current) boostEl.current.style.opacity = car.boost > 0 ? "1" : "0";
    engine(s.phase === "countdown" ? 0 : car.speed, car.boost > 0);
  });

  const medals = map.author_time ? medalTimes(map.author_time) : [];
  return (
    <div className="rc-race">
      <RaceScene session={session} ghosts={showGhosts ? allGhosts : []} color={color} hudRef={hudRef} />
      <div className="rc-hud">
        <div className="rc-top">
          <button className="icon" onClick={onExit} title="Menu (Échap)">✕</button>
          <div className="rc-title"><b>{map.name}</b><small>{mode === "test" ? "Test de la map" : map.official ? world.name : `par ${map.author}`}</small></div>
          <div className="grow" />
          {mode === "play" && (
            <>
              <button className={`pill ${showGhosts ? "on" : ""}`} onClick={() => setShowGhosts((v) => !v)}>👻 {showGhosts ? allGhosts.length : "off"}</button>
              <button className="pill" onClick={() => setBoard(true)}>🏆 Classement</button>
            </>
          )}
        </div>
        <div className="rc-side">
          {pb && <div className="rc-row"><small>Record perso</small><b>{formatTime(pb.ms)}</b></div>}
          {medals.map((m) => (
            <div key={m.id} className="rc-row"><i style={{ background: m.color }} /><small>{m.label}</small><b>{formatTime(m.ms)}</b></div>
          ))}
        </div>
        {count > 0 && !result && <div className="rc-count" key={count}>{count}</div>}
        {count === 0 && <div className="rc-count go" key="go">GO</div>}
        {flash && <div className={`rc-flash ${flash.bad ? "bad" : ""}`}>{flash.text}{flash.sub && <em>{flash.sub}</em>}</div>}
        <div className="rc-boost" ref={boostEl}>TURBO</div>
        <div className="rc-bottom">
          <div className="rc-cp">CP <b ref={cpEl}>0/{track.cps.length}</b></div>
          <div className="rc-time" ref={timeEl}>0:00.000</div>
          <div className="rc-speed"><b ref={speedEl}>0</b><small>km/h</small></div>
        </div>
        <p className="rc-keys">↑↓←→ / ZQSD · Espace dérapage · Entrée checkpoint · R recommencer · Échap menu</p>
        {isTouch && !result && <TouchPad />}
      </div>
      {result && (
        <div className="rc-result">
          <div className="rc-result-card">
            <small>{mode === "test" ? "Map validée" : "Arrivée"}</small>
            <div className="rc-result-time">{formatTime(result.ms)}</div>
            {result.prev != null && <div className={`rc-delta ${result.ms < result.prev ? "good" : "bad"}`}>{delta(result.ms - result.prev)} vs record perso</div>}
            {result.medal && <div className="rc-medal" style={{ "--m": result.medal.color }}>Médaille {result.medal.label}</div>}
            {mode === "play" && (
              <p className="rc-save">
                {pseudo === "Joueur" ? "Choisis un pseudo dans le Casino pour apparaître au classement." : result.saving ? "Enregistrement…" : result.rank ? `Classement : ${result.rank}${result.rank === 1 ? "er" : "e"}` : "Temps enregistré"}
              </p>
            )}
            <div className="row">
              <button className="btn primary" onClick={() => session.restart()}>Rejouer <kbd>R</kbd></button>
              {mode === "play" && <button className="btn" onClick={() => setBoard(true)}>Classement</button>}
              {onNext && <button className="btn" onClick={onNext}>Suivante ▶</button>}
              <button className="btn ghost" onClick={onExit}>{mode === "test" ? "Éditeur" : "Menu"}</button>
            </div>
          </div>
        </div>
      )}
      {board && <Board map={map} pseudo={pseudo} onClose={() => setBoard(false)} />}
    </div>
  );
}
