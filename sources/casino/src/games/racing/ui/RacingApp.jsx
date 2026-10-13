import React from "react";
import { getMap, listMaps, loadPBs, playerRecords, worldRecords } from "../api.js";
import { MEDALS, OFFICIAL, medalFor } from "../maps.js";
import { WORLDS, formatTime } from "../physics.js";
import { Board } from "./Board.jsx";
import { Pilots } from "./Pilots.jsx";
import { AlertToasts, Records, useRecordAlerts } from "./Records.jsx";
import { padLabels, useGamepad, useGamepadNav } from "../gamepad.js";
import { Editor, newDoc } from "./Editor.jsx";
import { CAR_COLORS, RaceView, loadCarColor, saveCarColor } from "./RaceView.jsx";
import "./racing.css";

const TAB_KEY = "racing-tab";

function MedalDot({ medal }) {
  return medal ? <i className="rc-dot" style={{ background: medal.color }} title={`Médaille ${medal.label}`} /> : <i className="rc-dot empty" />;
}

function Campaign({ pbs, wrs, onPlay, onBoard }) {
  const [world, setWorld] = React.useState(() => {
    try { return +localStorage.getItem("racing-world") || 0; } catch { return 0; }
  });
  const pick = (i) => { setWorld(i); try { localStorage.setItem("racing-world", String(i)); } catch {} };
  const maps = OFFICIAL.filter((m) => m.world === world);
  return (
    <>
      <div className="rc-worlds">
        {WORLDS.map((w, i) => {
          const got = OFFICIAL.filter((m) => m.world === i && medalFor(pbs[m.id]?.ms, m.author_time)).length;
          return (
            <button key={w.id} className={`rc-world ${i === world ? "on" : ""}`} style={{ "--sky": w.sky, "--acc": w.accent, "--gr": w.ground }} onClick={() => pick(i)}>
              <b>{w.name}</b>
              <small>{got}/5 médailles</small>
            </button>
          );
        })}
      </div>
      <div className="rc-maps">
        {maps.map((m, i) => {
          const pb = pbs[m.id]?.ms;
          const medal = medalFor(pb, m.author_time);
          const wr = wrs[m.id];
          return (
            <div key={m.id} className="rc-map" style={{ "--acc": WORLDS[m.world].accent }}>
              <div className="rc-map-num">{i + 1}</div>
              <div className="rc-map-main">
                <b>{m.name.split(" · ")[1]}</b>
                <small><MedalDot medal={medal} /> {pb ? formatTime(pb) : "pas encore de temps"}{pbs[m.id]?.synced === false && <em className="rc-unsynced" title="Ce temps n'a pas été validé par le serveur : refais une course pour entrer au classement"> · non classé</em>}</small>
                <small className="rc-wr">🏆 {wr ? `${formatTime(wr.time_ms)} · ${wr.pseudo}` : "aucun record"}{wr ? ` · ${wr.players} pilote${wr.players > 1 ? "s" : ""}` : ""}</small>
              </div>
              <div className="rc-map-btns">
                <button className="btn primary" onClick={() => onPlay(m)}>Jouer</button>
                <button className="btn ghost" onClick={() => onBoard(m)} title="Classement">🏆</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Community({ onPlay, onBoard, pbs }) {
  const [q, setQ] = React.useState("");
  const [maps, setMaps] = React.useState(null);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => {
    const t = setTimeout(() => listMaps(q.trim()).then(setMaps).catch((e) => setErr(e.message)), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <>
      <input className="rc-search" value={q} placeholder="Chercher une map ou un auteur" onChange={(e) => setQ(e.target.value)} />
      {err && <p className="err">{err}</p>}
      {maps && !maps.length && <p className="hint">Aucune map publiée{q ? " pour cette recherche" : " pour l’instant : crée la première dans l’éditeur"}.</p>}
      <div className="rc-maps">
        {(maps || []).map((m) => {
          const map = { id: m.map_id, name: m.name, author: m.author, author_time: m.author_time };
          const pb = pbs[m.map_id]?.ms;
          return (
            <div key={m.map_id} className="rc-map">
              <div className="rc-map-main">
                <b>{m.name}</b>
                <small>par {m.author} · auteur {formatTime(m.author_time)}</small>
                <small className="rc-wr"><MedalDot medal={medalFor(pb, m.author_time)} /> {pb ? formatTime(pb) : "pas encore de temps"} · {m.players} pilote{m.players > 1 ? "s" : ""}</small>
              </div>
              <div className="rc-map-btns">
                <button className="btn primary" onClick={() => onPlay(map)}>Jouer</button>
                <button className="btn ghost" onClick={() => onBoard(map)} title="Classement">🏆</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function RacingApp({ pseudo, onQuit }) {
  const [tab, setTab] = React.useState(() => { try { return localStorage.getItem(TAB_KEY) || "campaign"; } catch { return "campaign"; } });
  const [race, setRace] = React.useState(null); // { map, mode }
  const [board, setBoard] = React.useState(null);
  const [doc, setDoc] = React.useState(newDoc);
  const [pbs, setPbs] = React.useState(loadPBs);
  const [wrs, setWrs] = React.useState({});
  const [color, setColor] = React.useState(loadCarColor);
  const [loading, setLoading] = React.useState(false);

  const pad = useGamepad();
  const [padToast, setPadToast] = React.useState(null);
  const lastPad = React.useRef(pad?.id || null);
  React.useEffect(() => {
    const id = pad?.id || null;
    if (id === lastPad.current) return;
    setPadToast(id ? { on: true, kind: pad.kind } : { on: false });
    lastPad.current = id;
    const t = setTimeout(() => setPadToast(null), 3000);
    return () => clearTimeout(t);
  }, [pad?.id]);
  const toast = padToast && (
    <div className={`rc-padtoast ${padToast.on ? "" : "off"}`}>
      🎮 {padToast.on ? `Manette ${{ xbox: "Xbox", playstation: "PlayStation", switch: "Switch", generic: "" }[padToast.kind]} connectée` : "Manette déconnectée"}
    </div>
  );
  // navigation au pad dans le menu (pas pendant la course ni dans l'éditeur)
  const menuNav = !race && tab !== "editor";
  useGamepadNav(menuNav && !board && !loading, { onBack: onQuit });
  useGamepadNav(menuNav && !!board, { onBack: () => setBoard(null) });

  const rec = useRecordAlerts(pseudo);
  React.useEffect(() => { if (tab === "records" && !race) { const t = setTimeout(rec.markRead, 1500); return () => clearTimeout(t); } }, [tab, race, rec.history.length]);
  const alertsUi = <AlertToasts toasts={rec.toasts} dismiss={rec.dismiss} onOpen={() => { setRace(null); pickTab("records"); }} />;

  const pickTab = (t) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch {} };
  React.useEffect(() => {
    if (race) return;
    // records perso locaux comparés à ceux du serveur : un temps local plus rapide que le temps classé n'a pas été validé
    const local = loadPBs();
    setPbs(local);
    if (pseudo && pseudo !== "Joueur") {
      playerRecords(pseudo).then((rows) => {
        const srv = Object.fromEntries(rows.map((r) => [r.map_id, r.time_ms]));
        const next = { ...local };
        for (const [id, p] of Object.entries(next)) next[id] = { ...p, synced: srv[id] != null && srv[id] <= p.ms };
        setPbs(next);
      }).catch(() => {});
    }
    worldRecords(OFFICIAL.map((m) => m.id)).then(setWrs);
  }, [race]);

  const play = async (map) => {
    if (map.data) return setRace({ map, mode: "play" });
    setLoading(true);
    try {
      const full = await getMap(map.id);
      if (full) setRace({ map: { id: full.map_id, name: full.name, author: full.author, author_time: full.author_time, world: full.data.world, data: full.data }, mode: "play" });
    } finally {
      setLoading(false);
    }
  };

  if (race) {
    const { map, mode } = race;
    const idx = OFFICIAL.findIndex((m) => m.id === map.id);
    const next = idx >= 0 && idx < OFFICIAL.length - 1 ? OFFICIAL[idx + 1] : null;
    return (
      <>
      {toast}
      {alertsUi}
      <RaceView
        key={map.id + mode + (race.n || 0)}
        map={map}
        mode={mode}
        pseudo={pseudo}
        onExit={() => setRace(null)}
        onNext={next ? () => setRace({ map: next, mode: "play" }) : null}
        onTestDone={(ms) => setDoc((d) => ({ ...d, authorTime: d.authorTime ? Math.min(d.authorTime, ms) : ms }))}
      />
      </>
    );
  }

  const medals = OFFICIAL.reduce((n, m) => n + (medalFor(pbs[m.id]?.ms, m.author_time) ? 1 : 0), 0);
  if (tab === "editor") {
    return (
      <Editor
        doc={doc}
        setDoc={setDoc}
        pseudo={pseudo}
        onExit={() => pickTab("campaign")}
        onTest={(d) => setRace({ map: { id: "test", name: d.name || "Test", author_time: null, world: d.world, data: { v: 1, world: d.world, tiles: d.tiles } }, mode: "test" })}
        onPlayPublished={(m) => { setDoc(newDoc()); pickTab("community"); setRace({ map: m, mode: "play" }); }}
      />
    );
  }

  return (
    <div className="rc-menu">
      <header className="rc-menu-head">
        <button className="icon" onClick={onQuit} title="Retour au Casino">←</button>
        <h1>Track<em>Merdia</em></h1>
        <div className="grow" />
        <div className="rc-medals" title="Médailles de la campagne">
          {MEDALS.map((m) => <i key={m.id} className="rc-dot" style={{ background: m.color }} />)}
          <b>{medals}/{OFFICIAL.length}</b>
        </div>
      </header>
      <div className="rc-menu-layout">
      <div className="rc-menu-body">
        <nav className="rc-tabs">
          <button className={tab === "campaign" ? "on" : ""} onClick={() => pickTab("campaign")}>Campagne</button>
          <button className={tab === "community" ? "on" : ""} onClick={() => pickTab("community")}>Communauté</button>
          <button className={tab === "records" ? "on" : ""} onClick={() => pickTab("records")}>
            Records{rec.alerts.length > 0 && <span className="rc-badge">{rec.alerts.length}</span>}
          </button>
          <button onClick={() => pickTab("editor")}>Éditeur</button>
          <div className="grow" />
          <div className="rc-colors" title="Couleur de ta voiture">
            {CAR_COLORS.map((c) => (
              <button key={c} className={c === color ? "on" : ""} style={{ background: c }} onClick={() => { setColor(c); saveCarColor(c); }} />
            ))}
          </div>
        </nav>
        <p className="rc-pilot">Pilote : <b>{pseudo}</b>{pseudo === "Joueur" && " · choisis un pseudo dans le Casino pour entrer au classement"}</p>
        {tab === "records" ? (
          <Records pseudo={pseudo} alerts={rec.alerts} history={rec.history} onPlay={play} onBoard={setBoard} />
        ) : tab === "community" ? (
          <Community pbs={pbs} onPlay={play} onBoard={setBoard} />
        ) : (
          <Campaign pbs={pbs} wrs={wrs} onPlay={play} onBoard={setBoard} />
        )}
      </div>
      <aside className="rc-side-rank">
        <h3>🏆 Classement des pilotes</h3>
        <Pilots pseudo={pseudo} compact />
      </aside>
      </div>
      {loading && <div className="modal soft"><div className="spinner" /></div>}
      {toast}
      {alertsUi}
      {pad && <p className="rc-padhint">🎮 croix ou stick : se déplacer · {padLabels(pad.kind).A} : valider · {padLabels(pad.kind).B} : retour</p>}
      {board && <Board map={board} pseudo={pseudo} onClose={() => setBoard(null)} />}
    </div>
  );
}
