import React from "react";

export function AfkToast({ afk, state, me }) {
  const [endAt, setEndAt] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    setEndAt(afk ? Date.now() + afk.ms : 0);
  }, [afk]);
  React.useEffect(() => {
    if (!afk) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [afk]);
  if (!afk || !endAt) return null;
  const secs = Math.max(0, Math.ceil((endAt - now) / 1000));
  if (secs > 20) return null;
  const target = state.players.find((p) => p.id === afk.id);
  const grace = afk.kind === "grace";
  const mine = grace ? !!afk.ids?.includes(me.id) : afk.id === me.id;
  if (grace) {
    const names = state.players
      .filter((p) => {
        return afk.ids?.includes(p.id);
      })
      .map((p) => p.name)
      .join(", ");
    return (
      <div className={"toast afk" + (mine ? " mine" : "")}>
        {mine
          ? `Mise maintenant ! Ton tour sera passé dans ${secs}s`
          : `La manche démarre dans ${secs}s (${names} n'a pas misé)`}
      </div>
    );
  }
  return (
    <div className={"toast afk" + (mine ? " mine" : "")}>
      {mine
        ? `Joue ou tu seras deconnecte dans ${secs}s`
        : `${target ? target.name : "Un joueur"} est inactif (${secs}s)`}
    </div>
  );
}
