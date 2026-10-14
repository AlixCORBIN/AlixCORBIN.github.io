import React from "react";
import { adminCampaignUpsert, amIAdmin, deleteDraft, loadDrafts, publishMap, saveDraft, seasonLive } from "../api.js";
import { OFFICIAL } from "../maps.js";
import { WORLDS, formatTime } from "../physics.js";
import { BLOCKS, BLOCK_KEYS, TILE, blockKeysForSeason, defaultParams, occupancy, resolveType, sampleBlock, sectionPoints, tileSurface, toWorld } from "../blocks.js";
import { GRID, MAX_LEVEL, Track, mapData } from "../track.js";
import { trackMeta } from "../meta.js";
import { TrackPreview } from "../three/RaceScene.jsx";

const CATS = [...new Set(BLOCK_KEYS.map((k) => BLOCKS[k].cat))];
const HOTKEYS = ["road", "turn", "bank", "bigturn", "slope", "steep", "loop", "wall", "cp"];
const FILL = { road: "#4a4e57", dirt: "#7a5634", ice: "#9fd6ee", boost: "#4a4e57", boost2: "#4a4e57", brake: "#8a1f24", glue: "#6b2fa0", oil: "#0a0a0f", water: "#1f7fd1", revboost: "#4a4e57" };
const GATE = { start: "#18a04a", cp: "#1f6fe0", finish: "#f2f2f2", teleport: "#7a2fd0", switch: "#c9a100" };
// Couleur d'un bloc de la saison 2 sans surface propre (pastille dessinée au centre)
const S2_DOT = { gate: "#e0262c", door: "#d4262c", crate: "#a8743a", lift: "#c9ccd2", wind: "#6fe3ff", gravity: "#6a4cff", rail: "#d8dde4", kicker2: "#ffd23f",
  revboost: "#ff2f4f", jet: "#29e0ff", tunnel: "#ff9f1c", halftube: "#ff9f1c", hloop: "#ff3fd8", loopx: "#ff3fd8", pipe: "#3fd3ff", wallin: "#a6ff4d", wallrun: "#a6ff4d", wallout: "#a6ff4d", cut: "#ffd23f", bump: "#ffd23f" };

export const newDoc = () => ({ id: crypto.randomUUID(), name: "", world: 0, tiles: [], authorTime: null });

const asTile = ([x, z, type, rot, level, p]) => ({ x, z, type, rot, level, ...(p ? { p } : {}) });
const occCache = new Map();
function occOf(t) {
  const k = t.join(",");
  if (!occCache.has(k)) occCache.set(k, occupancy(asTile(t)));
  return occCache.get(k);
}
const levelsOf = (t) => new Set([...occOf(t)].map((k) => +k.split(",")[2]));

// Dessin vu de dessus : le profil de la route projeté au sol, plus clair quand c'est haut
function drawTile(g, t, s, alpha) {
  const tile = asTile(t);
  tile.type = resolveType(tile.type, tile.p);
  const def = BLOCKS[tile.type];
  const surf = tileSurface(tile);
  const S = sampleBlock(tile.type);
  const k = s / TILE;
  const P = (lp) => { const w = toWorld(tile, lp); return [w[0] * k, w[2] * k, w[1]]; };
  g.save();
  g.globalAlpha = alpha;
  for (let i = 0; i < S.length - 1; i++) {
    const A = sectionPoints(tile.type, S[i]), B = sectionPoints(tile.type, S[i + 1]);
    const a0 = P(A[0]), a1 = P(A[A.length - 1]), b0 = P(B[0]), b1 = P(B[B.length - 1]);
    const h = (a0[2] + a1[2]) / 2;
    const light = Math.min(40, h * 1.2);
    g.fillStyle = h > 0.5 ? `hsl(220 8% ${30 + light}%)` : FILL[surf] || "#4a4e57";
    if (surf === "dirt" || surf === "ice" || surf === "water") g.fillStyle = FILL[surf];
    g.beginPath();
    g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.lineTo(b1[0], b1[1]); g.lineTo(b0[0], b0[1]);
    g.closePath();
    g.fill();
  }
  // axe et sens
  g.strokeStyle = def.surface === "boost" ? "#ff8a1f" : "rgba(255,255,255,.55)";
  g.lineWidth = Math.max(1, s * 0.05);
  g.beginPath();
  S.forEach((f, i) => { const p = P(f.p); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
  g.stroke();
  if (def.dir || def.gate) {
    const f = S[Math.floor(S.length / 2)];
    const p = P(f.p), t2 = toWorld(tile, f.t, true);
    const ang = Math.atan2(t2[2], t2[0]);
    g.save();
    g.translate(p[0], p[1]);
    g.rotate(ang);
    if (def.gate) {
      g.fillStyle = GATE[def.gate];
      g.fillRect(-s * 0.08, -s * 0.36, s * 0.16, s * 0.72);
    }
    if (def.dir) {
      g.strokeStyle = "#fff";
      g.beginPath(); g.moveTo(-s * 0.15, -s * 0.15); g.lineTo(s * 0.12, 0); g.lineTo(-s * 0.15, s * 0.15); g.stroke();
    }
    g.restore();
  }
  // blocs de la saison 2 : pastille de couleur et réglage principal
  if (def.season) {
    const base = def.base || tile.type;
    const c = S2_DOT[base] || (def.surface && FILL[def.surface]) || GATE[def.gate];
    if (c) { g.fillStyle = c; g.beginPath(); g.arc(tile.x * s + s / 2, tile.z * s + s / 2, s * 0.16, 0, 7); g.fill(); }
    const main = Object.keys(def.params || {})[0];
    if (main && tile.p) {
      g.fillStyle = "#fff";
      g.font = `700 ${Math.max(8, s * 0.26)}px system-ui`;
      g.fillText(String(tile.p[main]), tile.x * s + 2, tile.z * s + s - 3);
    }
  }
  // niveau max du bloc
  const lv = Math.max(...levelsOf(t));
  if (lv > 0) {
    g.fillStyle = "#ffd23f";
    g.font = `700 ${Math.max(9, s * 0.3)}px system-ui`;
    g.fillText(String(lv), tile.x * s + 3, tile.z * s + s * 0.32);
  }
  g.restore();
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
  // Blocs de la saison 2 : visibles seulement pour un admin ou une fois la saison 's2' ouverte
  const [admin, setAdmin] = React.useState(false);
  const [s2Live, setS2Live] = React.useState(false);
  const [toolP, setToolP] = React.useState({}); // réglages tile.p du bloc sélectionné, par type
  const [s2Form, setS2Form] = React.useState(null); // { name, ord } quand le formulaire d'envoi est ouvert
  React.useEffect(() => {
    let off = false;
    amIAdmin().then((v) => !off && setAdmin(v));
    seasonLive("s2").then((v) => !off && setS2Live(v));
    return () => { off = true; };
  }, []);
  const keys = React.useMemo(() => blockKeysForSeason(admin || s2Live ? 2 : 1), [admin, s2Live]);

  const err = React.useMemo(() => new Track(mapData(0, doc.tiles)).validate(), [doc.tiles]);

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
    if (erase) {
      // efface le bloc le plus haut qui touche cette case au niveau courant (ou n'importe quel niveau à défaut)
      const hits = doc.tiles.filter((o) => occOf(o).has(`${x},${z},${level}`) || (o[0] === x && o[1] === z));
      if (!hits.length) return;
      const victim = hits.find((o) => levelsOf(o).has(level)) || hits[0];
      update(doc.tiles.filter((o) => o !== victim));
      return;
    }
    const t = [x, z, tool, tool === "platform" ? 0 : rot, level];
    if (BLOCKS[tool]?.params) t.push({ ...defaultParams(tool), ...(toolP[tool] || {}) });
    if (doc.tiles.some((o) => JSON.stringify(o) === JSON.stringify(t))) return;
    const mine = occOf(t);
    let tiles = doc.tiles.filter((o) => ![...occOf(o)].some((k) => mine.has(k)));
    if (tool === "start") tiles = tiles.filter((o) => o[2] !== "start");
    tiles.push(t);
    update(tiles);
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
    g.fillStyle = WORLDS[doc.world].void ? "#0d1220" : WORLDS[doc.world].id === "neon" ? "#120b26" : "#2c5a2a";
    g.fillRect(0, 0, GRID * s, GRID * s);
    g.strokeStyle = "rgba(255,255,255,.08)";
    for (let i = 0; i <= GRID; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, GRID * s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(GRID * s, i * s); g.stroke();
    }
    const sorted = [...doc.tiles].sort((a, b) => a[4] - b[4]);
    for (const t of sorted) drawTile(g, t, s, levelsOf(t).has(level) || t[4] === level ? 1 : 0.35);
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
      else if (e.code === "PageUp" || e.key === "+") setLevel((l) => Math.min(MAX_LEVEL, l + 1));
      else if (e.code === "PageDown" || e.key === "-") setLevel((l) => Math.max(0, l - 1));
      else if (e.code === "KeyE") setTool("erase");
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); undo(); }
      else {
        const i = Number(e.key) - 1;
        if (i >= 0 && i < HOTKEYS.length) setTool(HOTKEYS[i]);
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
      const id = await publishMap(name, pseudo, mapData(doc.world, doc.tiles), doc.authorTime);
      deleteDraft(doc.id);
      onPlayPublished({ id, name, author: pseudo, author_time: doc.authorTime, world: doc.world, data: mapData(doc.world, doc.tiles) });
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendToS2 = async () => {
    const name = s2Form.name.trim();
    const ord = parseInt(s2Form.ord, 10);
    if (!name || !Number.isInteger(ord) || ord < 1) { setMsg("Nom et ordre (entier ≥ 1) requis."); return; }
    setBusy(true);
    try {
      const data = mapData(doc.world, doc.tiles);
      await adminCampaignUpsert({
        mapId: `s2-${String(ord).padStart(2, "0")}`, seasonId: "s2", ord, name,
        data, authorMs: doc.authorTime, meta: trackMeta(data),
      });
      setMsg(`Map « ${name} » envoyée dans la campagne S2 (position ${ord}).`);
      setS2Form(null);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const previewTrack = React.useMemo(() => (preview ? new Track(mapData(doc.world, doc.tiles)) : null), [preview, doc]);

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
            {WORLDS.map((w, i) => ((w.season ?? 1) === 1 || admin || s2Live || i === doc.world) && <option key={w.id} value={i}>{w.name}{w.season === 2 ? ` · saison 2 (${w.style}, sans sol)` : ""}</option>)}
          </select>
        </label>
        <div className="rc-palette">
          {CATS.map((c) => (
            <React.Fragment key={c}>
              <small className="rc-cat">{c}</small>
              {keys.filter((k) => BLOCKS[k].cat === c).map((t) => (
                <button key={t} className={tool === t ? "on" : ""} onClick={() => setTool(t)}>
                  {HOTKEYS.includes(t) && <kbd>{HOTKEYS.indexOf(t) + 1}</kbd>}{BLOCKS[t].label}
                </button>
              ))}
            </React.Fragment>
          ))}
          <button className={tool === "erase" ? "on danger" : "danger"} onClick={() => setTool("erase")}><kbd>E</kbd>Gomme</button>
        </div>
        {BLOCKS[tool]?.params && (
          <div className="rc-params">
            <small className="rc-cat">Réglages de « {BLOCKS[tool].label} »</small>
            {Object.entries(BLOCKS[tool].params).map(([k, d]) => (
              <label key={k}>{d.label}
                <input
                  type="number" min={d.min} max={d.max} step={d.step}
                  value={toolP[tool]?.[k] ?? d.def}
                  onChange={(e) => {
                    const v = Math.max(d.min, Math.min(d.max, Number(e.target.value)));
                    setToolP({ ...toolP, [tool]: { ...(toolP[tool] || {}), [k]: Number.isFinite(v) ? v : d.def } });
                  }}
                />
              </label>
            ))}
          </div>
        )}
        <div className="rc-ctrl">
          <button className="btn" onClick={() => setRot((r) => (r + 1) & 3)}>↻ Rotation <kbd>R</kbd></button>
          <div className="rc-level">
            <button className="btn" onClick={() => setLevel((l) => Math.max(0, l - 1))}>−</button>
            <span>Niveau <b>{level}</b></span>
            <button className="btn" onClick={() => setLevel((l) => Math.min(MAX_LEVEL, l + 1))}>+</button>
          </div>
        </div>
        <p className="hint">Clic : poser · clic droit : effacer · Ctrl+Z : annuler. Les blocs s’enchaînent dans les deux sens ; les pentes montent depuis le côté d’entrée (R pour tourner). Le chiffre jaune donne la hauteur.</p>
        <div className="rc-status">
          {err ? <span className="err">{err}</span> : doc.authorTime ? <span className="ok">Validée en {formatTime(doc.authorTime)}</span> : <span>Termine la map en test pour pouvoir la publier.</span>}
        </div>
        <div className="rc-actions">
          <button className="btn primary" disabled={!!err} onClick={() => onTest(doc)}>▶ Tester</button>
          <button className="btn" onClick={() => setPreview((v) => !v)}>{preview ? "Vue de dessus" : "Aperçu 3D"}</button>
          <button className="btn" onClick={save}>Sauvegarder</button>
          <button className="btn" onClick={() => setOpen(true)}>Ouvrir…</button>
          <button className="btn primary" disabled={!doc.authorTime || busy || !!err} onClick={publish}>{busy ? "Publication…" : "🌐 Publier"}</button>
          {admin && <button className="btn" disabled={!doc.authorTime || busy || !!err} onClick={() => setS2Form({ name: doc.name || "", ord: "1" })}>Envoyer dans la campagne S2</button>}
        </div>
        {admin && s2Form && (
          <div className="rc-s2form">
            <label>Nom dans la campagne<input value={s2Form.name} maxLength={40} onChange={(e) => setS2Form({ ...s2Form, name: e.target.value })} /></label>
            <label>Ordre<input type="number" min="1" value={s2Form.ord} onChange={(e) => setS2Form({ ...s2Form, ord: e.target.value })} /></label>
            <div className="rc-actions">
              <button className="btn primary" disabled={busy} onClick={sendToS2}>{busy ? "Envoi…" : "Envoyer"}</button>
              <button className="btn" onClick={() => setS2Form(null)}>Annuler</button>
            </div>
          </div>
        )}
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
