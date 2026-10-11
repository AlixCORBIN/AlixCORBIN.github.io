import React from "react";
import { deleteDraft, loadDrafts, publishMap, saveDraft } from "../api.js";
import { OFFICIAL } from "../maps.js";
import { WORLDS, formatTime } from "../physics.js";
import { BLOCKS, GRID, ROAD_HALF, TILE, Track } from "../track.js";
import { TrackPreview } from "../three/RaceScene.jsx";

const TYPES = Object.keys(BLOCKS);
const COLORS = { road: "#4a4e57", turn: "#4a4e57", ramp: "#6b7480", boost: "#4a4e57", start: "#4a4e57", cp: "#4a4e57", finish: "#4a4e57", wide: "#5a5e68", dirt: "#7a5634" };

export const newDoc = () => ({ id: crypto.randomUUID(), name: "", world: 0, tiles: [], authorTime: null });

// Cases (niveaux) occupées par un bloc : une pente occupe son niveau et le suivant
const occ = ([, , type, , l]) => (type === "ramp" ? [l, l + 1] : [l]);

function drawTile(g, t, s, alpha) {
  const [x, z, type, rot, level] = t;
  const k = s / TILE;
  g.save();
  g.globalAlpha = alpha;
  g.translate((x + 0.5) * s, (z + 0.5) * s);
  g.rotate((rot * Math.PI) / 2);
  g.scale(k, k);
  const H = TILE / 2, R = ROAD_HALF;
  g.fillStyle = COLORS[type];
  if (type === "turn") {
    g.beginPath();
    g.arc(H, H, H + R, Math.PI, 1.5 * Math.PI);
    g.arc(H, H, H - R, 1.5 * Math.PI, Math.PI, true);
    g.closePath();
    g.fill();
  } else if (type === "wide") {
    g.fillRect(-H, -H, TILE, TILE);
  } else {
    g.fillRect(-R, -H, 2 * R, TILE);
    if (type === "ramp") {
      const gr = g.createLinearGradient(0, H, 0, -H);
      gr.addColorStop(0, "#3d424a");
      gr.addColorStop(1, "#a9b3c0");
      g.fillStyle = gr;
      g.fillRect(-R, -H, 2 * R, TILE);
    }
    const bar = { start: "#18a04a", cp: "#1f6fe0", finish: "#f2f2f2" }[type];
    if (bar) {
      g.fillStyle = bar;
      g.fillRect(-R - 2, -2.5, 2 * R + 4, 5);
      if (type === "finish") {
        g.fillStyle = "#111";
        for (let i = -R - 2; i < R + 2; i += 5) g.fillRect(i, ((i / 5) & 1) * 2.5 - 2.5, 2.5, 2.5);
      }
    }
    if (type === "boost" || type === "ramp" || type === "start") {
      g.strokeStyle = type === "boost" ? "#ff8a1f" : "#fff";
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(-6, 6); g.lineTo(0, -6); g.lineTo(6, 6);
      g.stroke();
    }
  }
  g.restore();
  if (level > 0) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = "#ffd23f";
    g.font = `700 ${Math.max(9, s * 0.3)}px system-ui`;
    g.fillText(String(level), x * s + 3, z * s + s * 0.32);
    g.restore();
  }
}

export function Editor({ doc, setDoc, pseudo, onTest, onExit, onPlayPublished }) {
  const canvas = React.useRef();
  const wrap = React.useRef();
  const [tool, setTool] = React.useState("road");
  const [rot, setRot] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [hover, setHover] = React.useState(null);
  const [cell, setCell] = React.useState(24);
  const [preview, setPreview] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const history = React.useRef([]);
  const painting = React.useRef(null);

  const err = React.useMemo(() => new Track({ tiles: doc.tiles }).validate(), [doc.tiles]);

  const update = (tiles) => {
    history.current.push(doc.tiles);
    if (history.current.length > 100) history.current.shift();
    setDoc({ ...doc, tiles, authorTime: null });
  };
  const undo = () => {
    const prev = history.current.pop();
    if (prev) setDoc({ ...doc, tiles: prev, authorTime: null });
  };

  const place = (x, z, erase) => {
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) return;
    const t = [x, z, tool, BLOCKS[tool].dir || tool === "turn" || tool === "cp" || tool === "finish" || tool === "road" || tool === "dirt" ? rot : 0, level];
    const mine = occ(t);
    let tiles = doc.tiles.filter((o) => !(o[0] === x && o[1] === z && occ(o).some((l) => (erase ? l === level : mine.includes(l)))));
    if (!erase) {
      if (tool === "start") tiles = tiles.filter((o) => o[2] !== "start");
      tiles.push(t);
    }
    if (tiles.length !== doc.tiles.length || !erase) {
      const same = !erase && doc.tiles.some((o) => o.join() === t.join());
      if (!same) update(tiles);
    }
  };

  // taille des cases selon la place disponible
  React.useEffect(() => {
    const ro = new ResizeObserver(() => {
      const r = wrap.current.getBoundingClientRect();
      setCell(Math.max(14, Math.floor(Math.min(r.width, r.height) / GRID)));
    });
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const s = cell, dpr = devicePixelRatio || 1;
    c.width = GRID * s * dpr;
    c.height = GRID * s * dpr;
    c.style.width = c.style.height = `${GRID * s}px`;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = WORLDS[doc.world].id === "neon" ? "#120b26" : "#2c5a2a";
    g.fillRect(0, 0, GRID * s, GRID * s);
    g.strokeStyle = "rgba(255,255,255,.08)";
    for (let i = 0; i <= GRID; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, GRID * s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(GRID * s, i * s); g.stroke();
    }
    const sorted = [...doc.tiles].sort((a, b) => a[4] - b[4]);
    for (const t of sorted) drawTile(g, t, s, occ(t).includes(level) ? 1 : 0.35);
    if (hover && !preview) {
      const [x, z] = hover;
      if (tool !== "erase") drawTile(g, [x, z, tool, rot, level], s, 0.55);
      g.strokeStyle = tool === "erase" ? "#ff5a5a" : "#ffd23f";
      g.lineWidth = 2;
      g.strokeRect(x * s + 1, z * s + 1, s - 2, s - 2);
    }
  }, [doc, hover, tool, rot, level, cell, preview]);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "KeyR") setRot((r) => (r + (e.shiftKey ? 3 : 1)) & 3);
      else if (e.code === "PageUp" || e.key === "+") setLevel((l) => Math.min(8, l + 1));
      else if (e.code === "PageDown" || e.key === "-") setLevel((l) => Math.max(0, l - 1));
      else if (e.code === "KeyE") setTool("erase");
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); undo(); }
      else {
        const i = TYPES.findIndex((t) => BLOCKS[t].key === e.key);
        if (i >= 0) setTool(TYPES[i]);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const cellAt = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / cell), Math.floor((e.clientY - r.top) / cell)];
  };
  const onDown = (e) => {
    e.preventDefault();
    const erase = e.button === 2 || tool === "erase";
    painting.current = { erase };
    const [x, z] = cellAt(e);
    place(x, z, erase);
  };
  const onMove = (e) => {
    const [x, z] = cellAt(e);
    if (!hover || hover[0] !== x || hover[1] !== z) {
      setHover([x, z]);
      // on ne peint en continu que les blocs droits, pour ne pas poser des virages partout
      if (painting.current && (painting.current.erase || ["road", "dirt", "wide"].includes(tool))) place(x, z, painting.current.erase);
    }
  };

  const save = () => { saveDraft(doc); setMsg("Brouillon enregistré sur cet appareil."); };
  const publish = async () => {
    if (!doc.authorTime) return;
    const name = doc.name.trim();
    if (!name) { setMsg("Donne un nom à ta map."); return; }
    if (!pseudo || pseudo === "Joueur") { setMsg("Choisis un pseudo dans le Casino avant de publier."); return; }
    setBusy(true);
    try {
      const id = await publishMap(name, pseudo, { v: 1, world: doc.world, tiles: doc.tiles }, doc.authorTime);
      deleteDraft(doc.id);
      onPlayPublished({ id, name, author: pseudo, author_time: doc.authorTime, world: doc.world, data: { v: 1, world: doc.world, tiles: doc.tiles } });
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const previewTrack = React.useMemo(() => (preview ? new Track({ tiles: doc.tiles, world: doc.world }) : null), [preview, doc]);

  return (
    <div className="rc-editor">
      <aside className="rc-tools">
        <div className="rc-tools-head">
          <button className="icon" onClick={onExit} title="Menu">✕</button>
          <b>Éditeur</b>
        </div>
        <label>Nom<input value={doc.name} maxLength={32} placeholder="Ma super piste" onChange={(e) => setDoc({ ...doc, name: e.target.value })} /></label>
        <label>Monde
          <select value={doc.world} onChange={(e) => setDoc({ ...doc, world: +e.target.value, authorTime: null })}>
            {WORLDS.map((w, i) => <option key={w.id} value={i}>{w.name}</option>)}
          </select>
        </label>
        <div className="rc-palette">
          {TYPES.map((t) => (
            <button key={t} className={tool === t ? "on" : ""} onClick={() => setTool(t)}>
              <kbd>{BLOCKS[t].key}</kbd>{BLOCKS[t].label}
            </button>
          ))}
          <button className={tool === "erase" ? "on danger" : "danger"} onClick={() => setTool("erase")}><kbd>E</kbd>Gomme</button>
        </div>
        <div className="rc-ctrl">
          <button className="btn" onClick={() => setRot((r) => (r + 1) & 3)}>↻ Rotation <kbd>R</kbd></button>
          <div className="rc-level">
            <button className="btn" onClick={() => setLevel((l) => Math.max(0, l - 1))}>−</button>
            <span>Niveau <b>{level}</b></span>
            <button className="btn" onClick={() => setLevel((l) => Math.min(8, l + 1))}>+</button>
          </div>
        </div>
        <p className="hint">Clic : poser · clic droit : effacer · Ctrl+Z : annuler. Une pente monte d’un niveau dans le sens de la flèche.</p>
        <div className="rc-status">
          {err ? <span className="err">{err}</span> : doc.authorTime ? <span className="ok">Validée en {formatTime(doc.authorTime)}</span> : <span>Termine la map en test pour pouvoir la publier.</span>}
        </div>
        <div className="rc-actions">
          <button className="btn primary" disabled={!!err} onClick={() => onTest(doc)}>▶ Tester</button>
          <button className="btn" onClick={() => setPreview((v) => !v)}>{preview ? "Vue de dessus" : "Aperçu 3D"}</button>
          <button className="btn" onClick={save}>Sauvegarder</button>
          <button className="btn" onClick={() => setOpen(true)}>Ouvrir…</button>
          <button className="btn primary" disabled={!doc.authorTime || busy || !!err} onClick={publish}>{busy ? "Publication…" : "🌐 Publier"}</button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </aside>
      <div className="rc-canvas" ref={wrap}>
        {preview ? (
          previewTrack && previewTrack.tiles.length ? <TrackPreview track={previewTrack} world={WORLDS[doc.world]} /> : <p className="hint">Rien à afficher.</p>
        ) : (
          <canvas
            ref={canvas}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => (painting.current = null)}
            onPointerLeave={() => { painting.current = null; setHover(null); }}
            onContextMenu={(e) => e.preventDefault()}
          />
        )}
      </div>
      {open && <OpenDialog onClose={() => setOpen(false)} onOpen={(d) => { history.current = []; setDoc(d); setOpen(false); }} />}
    </div>
  );
}

function OpenDialog({ onClose, onOpen }) {
  const [drafts, setDrafts] = React.useState(loadDrafts);
  return (
    <div className="modal" onClick={onClose}>
      <div className="panel rc-open" onClick={(e) => e.stopPropagation()}>
        <h2>Ouvrir</h2>
        <button className="btn" onClick={() => onOpen(newDoc())}>+ Nouvelle map vide</button>
        <h3>Mes brouillons</h3>
        {!drafts.length && <p className="hint">Aucun brouillon.</p>}
        {drafts.map((d) => (
          <div key={d.id} className="rc-open-row">
            <button className="link" onClick={() => onOpen({ ...d, authorTime: d.authorTime || null })}>{d.name || "Sans nom"} <small>{d.tiles.length} blocs · {WORLDS[d.world].name}</small></button>
            <button className="icon" title="Supprimer" onClick={() => { deleteDraft(d.id); setDrafts(loadDrafts()); }}>🗑</button>
          </div>
        ))}
        <h3>Partir d’une map officielle</h3>
        <div className="rc-open-grid">
          {OFFICIAL.map((m) => (
            <button key={m.id} className="btn" onClick={() => onOpen({ id: crypto.randomUUID(), name: `${m.name.split(" · ")[1]} (remix)`.slice(0, 32), world: m.world, tiles: m.data.tiles, authorTime: null })}>{m.name}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
