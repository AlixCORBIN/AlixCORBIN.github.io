import React from "react";
import { leaderboard } from "../api.js";
import { medalFor } from "../maps.js";
import { formatTime } from "../physics.js";

import { AdminName } from "../../../lib/admins.js";
export function Board({ map, pseudo, onClose }) {
  const [rows, setRows] = React.useState(null);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => {
    leaderboard(map.id, 500).then(setRows).catch((e) => setErr(e.message));
  }, [map.id]);
  const wr = rows?.[0]?.time_ms;
  const mine = rows?.find((r) => r.pseudo === pseudo);
  return (
    <div className="modal" onClick={onClose}>
      <div className="panel rc-board" onClick={(e) => e.stopPropagation()}>
        <h2>🏆 {map.name}</h2>
        <p className="sub">{rows ? `${rows.length} joueur${rows.length > 1 ? "s" : ""} classé${rows.length > 1 ? "s" : ""}` : "Chargement…"}{mine ? ` · tu es ${mine.rank}${mine.rank === 1 ? "er" : "e"}` : ""}</p>
        {err && <p className="err">{err}</p>}
        {rows && !rows.length && <p className="hint">Aucun temps pour l’instant. Le premier record est pour toi.</p>}
        {rows && rows.length > 0 && (
          <div className="rc-board-scroll">
            <table className="lb">
              <thead><tr><th>#</th><th>Pilote</th><th>Temps</th><th>Écart</th><th className="hide-sm">Essais</th><th className="hide-sm">Date</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const m = medalFor(r.time_ms, map.author_time);
                  return (
                    <tr key={r.pseudo} className={r.pseudo === pseudo ? "me" : ""}>
                      <td>{r.rank}</td>
                      <td>{m && <i className="rc-dot" style={{ background: m.color }} title={m.label} />}<AdminName name={r.pseudo} /></td>
                      <td>{formatTime(r.time_ms)}</td>
                      <td className="rc-gap">{r.time_ms === wr ? "—" : `+${((r.time_ms - wr) / 1000).toFixed(3)}`}</td>
                      <td className="hide-sm">{r.attempts}</td>
                      <td className="hide-sm">{new Date(r.updated_at).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <button className="btn" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
