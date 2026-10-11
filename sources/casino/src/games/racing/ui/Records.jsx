import React from "react";
import { listMaps, lostRecords, playerRecords } from "../api.js";
import { OFFICIAL, medalFor } from "../maps.js";
import { WORLDS, formatTime } from "../physics.js";
import { rumble } from "../gamepad.js";

const SEEN_KEY = "racing-alerts-seen";
const loadSeen = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const saveSeen = (iso) => { try { localStorage.setItem(SEEN_KEY, iso); } catch {} };

// Noms des maps : officielles en dur, communauté via la liste publiée
let communityNames = null;
async function mapNames() {
  if (!communityNames) {
    communityNames = {};
    try { for (const m of await listMaps("")) communityNames[m.map_id] = { name: m.name, author: m.author, author_time: m.author_time }; } catch {}
  }
  return communityNames;
}
export function mapInfo(id, names) {
  const o = OFFICIAL.find((m) => m.id === id);
  if (o) return { id, name: o.name, world: WORLDS[o.world].name, author_time: o.author_time, official: true, map: o };
  const c = names?.[id];
  if (c) return { id, name: c.name, world: `par ${c.author}`, author_time: c.author_time, map: { id, name: c.name, author: c.author, author_time: c.author_time } };
  return { id, name: id.startsWith("off-") ? "Ancienne piste" : "Map supprimée", world: "", author_time: null, map: null };
}

const gap = (a, b) => `+${((a - b) / 1000).toFixed(3)}`;

/* ---------- Alertes « record perdu » : interrogées toutes les 60 s ---------- */
export function useRecordAlerts(pseudo) {
  const [history, setHistory] = React.useState([]); // 30 derniers jours
  const [seen, setSeen] = React.useState(loadSeen);
  const [toasts, setToasts] = React.useState([]);
  const known = React.useRef(null);
  const named = pseudo && pseudo !== "Joueur";
  React.useEffect(() => {
    if (!named) { setHistory([]); return; }
    let alive = true;
    known.current = null;
    const check = async () => {
      const list = await lostRecords(pseudo, null);
      if (!alive) return;
      const names = await mapNames();
      const items = list.map((e) => ({ ...e, info: mapInfo(e.map_id, names) }));
      setHistory(items);
      // au premier passage : pas de toast pour l'historique (le badge suffit)
      if (known.current) {
        const fresh = items.filter((e) => !known.current.has(e.id));
        if (fresh.length) {
          setToasts((t) => [...fresh, ...t].slice(0, 3));
          rumble(0.5, 0.5, 200);
          fresh.forEach((e) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== e.id)), 8000));
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            for (const e of fresh) {
              try { new Notification("Record perdu sur TrackMerdia", { body: `${e.new_pseudo} t'a pris le record sur ${e.info.name} (${formatTime(e.new_time)})`, tag: `rc-${e.id}` }); } catch {}
            }
          }
        }
      }
      known.current = new Set(items.map((e) => e.id));
    };
    check();
    const t = setInterval(check, 60000);
    const vis = () => !document.hidden && check();
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [pseudo]);
  const alerts = history.filter((e) => !seen || e.created_at > seen);
  const markRead = React.useCallback(() => {
    if (!history.length) return;
    saveSeen(history[0].created_at);
    setSeen(history[0].created_at);
  }, [history]);
  return { alerts, history, toasts, markRead, dismiss: (id) => setToasts((t) => t.filter((x) => x.id !== id)) };
}

export function AlertToasts({ toasts, dismiss, onOpen }) {
  if (!toasts.length) return null;
  return (
    <div className="rc-alerts">
      {toasts.map((e) => (
        <button key={e.id} className="rc-alert" onClick={() => { dismiss(e.id); onOpen?.(); }}>
          <b>🏁 Record perdu</b>
          <span><em>{e.new_pseudo}</em> t'a pris le record sur <em>{e.info.name}</em></span>
          <small>{formatTime(e.old_time)} → {formatTime(e.new_time)}</small>
        </button>
      ))}
    </div>
  );
}

/* ---------- Onglet Records ---------- */
export function Records({ pseudo, alerts, history, onPlay, onBoard }) {
  const [rows, setRows] = React.useState(null);
  const [names, setNames] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [perm, setPerm] = React.useState(() => ("Notification" in window ? Notification.permission : "unsupported"));
  const named = pseudo && pseudo !== "Joueur";
  React.useEffect(() => {
    if (!named) return;
    Promise.all([playerRecords(pseudo), mapNames()]).then(([r, n]) => { setRows(r); setNames(n); }).catch((e) => setErr(e.message));
  }, [pseudo]);
  if (!named) return <p className="hint">Choisis un pseudo dans le Casino pour enregistrer tes temps et suivre tes records.</p>;
  const held = rows?.filter((r) => r.rank === 1) || [];
  const others = rows?.filter((r) => r.rank !== 1) || [];
  const askPerm = () => Notification.requestPermission().then(setPerm);
  const Row = ({ r }) => {
    const info = mapInfo(r.map_id, names);
    const m = medalFor(r.time_ms, info.author_time);
    return (
      <div className={`rc-rec ${r.rank === 1 ? "wr" : ""}`}>
        <div className="rc-rec-rank">{r.rank === 1 ? "👑" : `${r.rank}e`}<small>/{r.players}</small></div>
        <div className="rc-map-main">
          <b>{info.name}</b>
          <small>{info.world}</small>
        </div>
        <div className="rc-rec-time">
          <b>{m && <i className="rc-dot" style={{ background: m.color }} />}{formatTime(r.time_ms)}</b>
          <small>{r.rank === 1 ? "record du monde" : `${gap(r.time_ms, r.wr_time)} · 🏆 ${r.wr_pseudo}`}</small>
        </div>
        <div className="rc-map-btns">
          {info.map && <button className="btn primary" onClick={() => onPlay(info.map)}>Jouer</button>}
          {info.map && <button className="btn ghost" title="Classement" onClick={() => onBoard(info.map)}>🏆</button>}
        </div>
      </div>
    );
  };
  return (
    <div className="rc-records">
      {err && <p className="err">{err}</p>}
      {history.length > 0 && (
        <section>
          <h3>Records perdus {alerts.length > 0 && <span className="rc-badge">{alerts.length} nouveau{alerts.length > 1 ? "x" : ""}</span>}</h3>
          {history.slice(0, 8).map((e) => (
            <div key={e.id} className="rc-lost">
              <span><em>{e.new_pseudo}</em> t'a pris <em>{e.info.name}</em></span>
              <small>{formatTime(e.old_time)} → {formatTime(e.new_time)} · {new Date(e.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</small>
            </div>
          ))}
        </section>
      )}
      {perm === "default" && (
        <button className="btn rc-notif" onClick={askPerm}>🔔 Me prévenir aussi quand l'onglet est en arrière-plan</button>
      )}
      <section>
        <h3>Records du monde détenus {rows && <span className="rc-badge gold">{held.length}</span>}</h3>
        {!rows && !err && <div className="spinner" />}
        {rows && !held.length && <p className="hint">Aucun pour l'instant. À toi de jouer !</p>}
        {held.map((r) => <Row key={r.map_id} r={r} />)}
      </section>
      <section>
        <h3>Mes autres temps {rows && <span className="rc-badge">{others.length}</span>}</h3>
        {rows && !others.length && <p className="hint">Rien d'autre d'enregistré.</p>}
        {others.map((r) => <Row key={r.map_id} r={r} />)}
      </section>
    </div>
  );
}
