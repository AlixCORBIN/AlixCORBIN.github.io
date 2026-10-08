import React from "react";

export function Balance({ me, inPlay }) {
  const prev = React.useRef(me.bankroll);
  const [delta, setDelta] = React.useState(null);
  React.useEffect(() => {
    const diff = Math.round(me.bankroll - prev.current);
    prev.current = me.bankroll;
    if (diff === 0) return;
    setDelta({
      d: diff,
      k: Date.now(),
    });
    const timer = setTimeout(() => setDelta(null), 2600);
    return () => clearTimeout(timer);
  }, [me.bankroll]);
  const staked =
    inPlay !== undefined
      ? inPlay
      : me.bets
        ? me.bets.reduce((sum, b) => sum + b.amount, 0)
        : me.hands.length
          ? me.hands.reduce((sum, h) => sum + h.bet, 0) +
            me.pp +
            me.t3 +
            me.insurance
          : me.bet + me.pp + me.t3;
  return (
    <div className="balance" title="Ton solde">
      <small>Solde</small>
      <div className="amount">
        <span className="coin">●</span>
        <b>{Math.round(me.bankroll).toLocaleString("fr-FR")}</b>
        {delta && (
          <i key={delta.k} className={"delta " + (delta.d > 0 ? "pos" : "neg")}>
            {delta.d > 0 ? "+" : ""}
            {delta.d}
          </i>
        )}
      </div>
      {staked > 0 && (
        <span className="inplay">
          {"En jeu : "}
          {staked}
        </span>
      )}
    </div>
  );
}
