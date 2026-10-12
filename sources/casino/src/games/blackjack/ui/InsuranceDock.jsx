import "../../../styles/insurance.css";

export const INSURANCE_MS = 8000;

export function InsuranceDock({ ctrl, me }) {
  const cost = me.hands[0] ? Math.floor(me.hands[0].bet / 2) : 0;
  if (!me.hands.length || me.insuranceDecided)
    return (
      <div className="dock slim">
        <p className="hint">Assurance : en attente des autres joueurs...</p>
      </div>
    );
  const affordable = cost >= 1 && cost <= me.bankroll;
  const answer = (take) =>
    ctrl.act({
      t: "insurance",
      take,
    });
  // Simple notification au centre : pas de fond bloquant, on peut l'ignorer
  // (sans réponse, l'assurance est refusée automatiquement à la fin du décompte).
  return (
    <div className="insurance-note" role="status">
      <p>
        {"Le croupier montre un As. Assurance pour "}
        <b>{cost}</b>
        {" ? (paye 2 contre 1 s'il a blackjack)"}
      </p>
      <div className="row">
        <button
          className="btn primary"
          disabled={!affordable}
          onClick={() => answer(true)}
        >
          Assurer ({cost})
        </button>
        <button className="btn ghost" onClick={() => answer(false)}>
          Ignorer
        </button>
      </div>
      <i
        className="insurance-timer"
        style={{ animationDuration: `${INSURANCE_MS}ms` }}
      />
    </div>
  );
}
