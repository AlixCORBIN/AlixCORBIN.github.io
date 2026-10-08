import React from "react";
import { fetchLeaderboard } from "../api.js";

export function Leaderboard({ onClose }) {
  const [rows, setRows] = React.useState(null);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    fetchLeaderboard()
      .then(setRows)
      .catch((err) => setError(err.message || "erreur"));
  }, []);
  return (
    <div className="modal" onClick={onClose}>
      <div className="panel" onClick={(ev) => ev.stopPropagation()}>
        <h2>Classement</h2>
        {error && <p className="err">{error}</p>}
        {!rows && !error && <div className="spinner" />}
        {rows && rows.length === 0 && <p>Aucun score pour le moment.</p>}
        {rows && rows.length > 0 && (
          <table className="lb">
            <thead>
              <tr>
                <th>#</th>
                <th>Joueur</th>
                <th>Solde</th>
                <th>Mains</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{row.pseudo}</td>
                  <td>{row.bankroll}</td>
                  <td>{row.hands}</td>
                  <td>{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button className="btn primary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
