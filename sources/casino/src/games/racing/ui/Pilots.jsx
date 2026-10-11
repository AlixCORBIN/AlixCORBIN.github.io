import React from "react";
import { podium } from "../api.js";
import { formatTime } from "../physics.js";

// Classement des pilotes : celui qui a le plus de 1res places est premier, puis 2es, puis 3es
export function Pilots({ pseudo }) {
  const [rows, setRows] = React.useState(null);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => { podium(100).then(setRows).catch((e) => setErr(e.message)); }, []);
  const me = (p) => p && pseudo && p.toLowerCase() === pseudo.toLowerCase();
  const icon = ["🥇", "🥈", "🥉"];
  return (
    <div className="rc-pilots">
      <p className="hint">Classé au nombre de 1res places, puis de 2es, puis de 3es, sur toutes les pistes (campagne et communauté).</p>
      {err && <p className="err">{err}</p>}
      {!rows && !err && <div className="spinner" />}
      {rows && !rows.length && <p className="hint">Personne n’a encore de temps.</p>}
      {rows && rows.length > 0 && (
        <table className="lb rc-podium">
          <thead>
            <tr><th>#</th><th>Pilote</th><th title="1res places">🥇</th><th title="2es places">🥈</th><th title="3es places">🥉</th><th className="hide-sm" title="Top 10">Top 10</th><th className="hide-sm">Pistes</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.pseudo} className={`${me(r.pseudo) ? "me" : ""} ${i < 3 ? "top" : ""}`}>
                <td>{icon[i] || i + 1}</td>
                <td>{r.pseudo}</td>
                <td className="p1">{r.p1}</td>
                <td>{r.p2}</td>
                <td>{r.p3}</td>
                <td className="hide-sm">{r.top10}</td>
                <td className="hide-sm">{r.maps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
export { formatTime };
