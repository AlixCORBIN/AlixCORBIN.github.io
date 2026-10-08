export function InsuranceDock({ ctrl, me }) {
  const cost = me.hands[0] ? Math.floor(me.hands[0].bet / 2) : 0;
  if (!me.hands.length || me.insuranceDecided)
    return (
      <div className="dock slim">
        <p className="hint">Assurance : en attente des autres joueurs...</p>
      </div>
    );
  const affordable = cost >= 1 && cost <= me.bankroll;
  return (
    <div className="modal soft">
      <div className="panel">
        <h2>Assurance ?</h2>
        <p>
          {"Le croupier montre un As. Assurez votre main pour "}
          <b>{cost}</b>
          {" : paye 2 contre 1 s'il a blackjack."}
        </p>
        <div className="row">
          <button
            className="btn primary"
            disabled={!affordable}
            onClick={() =>
              ctrl.act({
                t: "insurance",
                take: true,
              })
            }
          >
            Assurer ({cost})
          </button>
          <button
            className="btn"
            onClick={() =>
              ctrl.act({
                t: "insurance",
                take: false,
              })
            }
          >
            Non merci
          </button>
        </div>
      </div>
    </div>
  );
}
