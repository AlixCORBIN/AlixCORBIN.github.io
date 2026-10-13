import React from "react";
import { ICON, LABEL, SAFETY_OF, kindOf } from "../cards.js";
import { GOALS, MAX_PLAYERS, MIN_PLAYERS, TARGETS, TURN_CHOICES } from "../engine.js";
import { playCardSound, playHazardSound, sfx } from "../sfx.js";
import { CAR_COLORS } from "../three/Car.jsx";
import { MbScene } from "../three/MbScene.jsx";
import { sound } from "../../../lib/sound.js";
import "./mb.css";

import { AdminName } from "../../../lib/admins.js";
const BATTLE_TXT = { acc: "💥 Accident", gas: "⛽ Panne", flat: "🛞 Crevaison", stop: "🔴 Feu rouge" };
const statusOf = (p) => (p.rolling ? "🟢 Roule" : BATTLE_TXT[p.battle] || "🔴 À l'arrêt");

function useCountdown(deadline) {
  const [left, setLeft] = React.useState(null);
  React.useEffect(() => {
    if (!deadline) return setLeft(null);
    const end = Date.now() + deadline.ms;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

export function MbCard({ k, small, selected, dim, onClick, onDoubleClick }) {
  return (
    <button
      className={`mb-card ${kindOf(k)} ${small ? "small" : ""} ${selected ? "sel" : ""} ${dim ? "dim" : ""}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      tabIndex={onClick ? 0 : -1}
    >
      <span className={"mb-ic" + (k === "limit" ? " sign" : "")}>{ICON[k]}</span>
      <span className="mb-lb">{LABEL[k]}</span>
    </button>
  );
}

function Header({ ctrl, state, onQuit, left }) {
  const [copied, setCopied] = React.useState(false);
  const [muted, setMuted] = React.useState(sound.isMuted());
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${ctrl.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <header className="topbar">
      <div className="brand">🚗 Mille Bornes</div>
      {ctrl.code && (
        <button className="pill" onClick={copy} title="Copier le lien d'invitation">
          Salle <b>{ctrl.code}</b> · {copied ? "copié !" : "copier le lien"}
        </button>
      )}
      <div className="grow" />
      {state.phase !== "lobby" && (
        <div className="pill mb-round">
          Manche {state.round} · talon {state.deckCount}
          {left !== null && state.phase === "playing" && <b className={left <= 8 ? "hurry" : ""}> {left}s</b>}
        </div>
      )}
      <button className="icon" onClick={() => setMuted(sound.toggle())} title="Son">
        {muted ? "🔇" : "🔊"}
      </button>
      <button className="icon" onClick={onQuit} title="Quitter">
        ✕
      </button>
    </header>
  );
}

function Lobby({ ctrl, state, me }) {
  const host = state.hostId === me.id;
  const s = state.settings;
  const n = state.players.length;
  const set = (patch) => ctrl.act({ t: "settings", patch });
  return (
    <div className="mb-panel panel">
      <h2>Mille Bornes</h2>
      <p className="sub">
        {n}/{MAX_PLAYERS} pilotes · minimum {MIN_PLAYERS} (complété par des bots)
      </p>
      <div className="mb-plist">
        {state.players.map((p, i) => (
          <div key={p.id} className={"mb-pl" + (p.id === me.id ? " me" : "")} style={{ "--car": CAR_COLORS[i] }}>
            <span>
              <i />
              {p.id === state.hostId ? "👑 " : ""}
              <AdminName name={p.name} id={p.id} />
            </span>
            <em>{p.bot ? "bot" : "prêt"}</em>
          </div>
        ))}
      </div>
      {host ? (
        <>
          <div className="mb-settings">
            <label className="mb-opt">
              <span>Distance du voyage</span>
              <select value={s.goal} onChange={(e) => set({ goal: +e.target.value })}>
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g ? `${g} km` : "auto (700 solo, 1000 équipes)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-opt">
              <span>Partie en</span>
              <select value={s.target} onChange={(e) => set({ target: +e.target.value })}>
                {TARGETS.map((t) => (
                  <option key={t} value={t}>
                    {t === 0 ? "une manche" : `${t} points`}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-opt">
              <span>Temps par tour</span>
              <select value={s.turnMs} onChange={(e) => set({ turnMs: +e.target.value })}>
                {TURN_CHOICES.map((t) => (
                  <option key={t} value={t}>
                    {t === 0 ? "illimité" : `${t / 1000} s`}
                  </option>
                ))}
              </select>
            </label>
            <button className={"mb-tg" + (s.teams ? " on" : "")} onClick={() => set({ teams: !s.teams })}>
              Équipes à 4 et 6 joueurs {s.teams ? "activées" : "désactivées"}
            </button>
            <p className="hint">
              {s.teams && (n === 4 || n === 6)
                ? "Partenaires assis en face : une voiture partagée par équipe."
                : n === 5 || n === 3
                  ? "En individuel à plusieurs, les attaques pleuvent : 4 ou 6 joueurs en équipes, c'est plus fluide."
                  : "Chacun pour soi."}
            </p>
          </div>
          <div className="row">
            <button className="btn ghost" disabled={n >= MAX_PLAYERS} onClick={() => ctrl.act({ t: "addBot" })}>
              + Bot
            </button>
            <button className="btn ghost" disabled={!state.players.some((p) => p.bot)} onClick={() => ctrl.act({ t: "removeBot" })}>
              − Bot
            </button>
            <button className="btn primary" onClick={() => ctrl.act({ t: "start" })}>
              Démarrer
            </button>
          </div>
        </>
      ) : (
        <p className="hint">L'hôte démarre la course quand tout le monde est là.</p>
      )}
    </div>
  );
}

function Plate({ members, index, me, active, turn }) {
  const p = members[0];
  return (
    <div className={`mb-plate ${active ? "turn" : ""} ${me ? "me" : ""}`} style={{ "--car": CAR_COLORS[index] }}>
      <b>
        {members.map((m) => (
          <span key={m.id} className={m.id === turn ? "cur" : ""}>
            {m.bot ? "🤖 " : ""}
            {m.name}
          </span>
        ))}
      </b>
      <span>
        {p.km} km · {statusOf(p)}
        {p.limit ? " · 50" : ""}
      </span>
      {p.safeties.length > 0 && <span className="mb-saf">{p.safeties.map((s) => ICON[s]).join(" ")}</span>}
    </div>
  );
}

const teamName = (state, p) =>
  p ? state.players.filter((x) => x.team === p.team).map((x) => x.name).join(" & ") : "";

function bannerText(state, meId) {
  const e = state.effect;
  if (!e) return null;
  const name = (id) => (id === meId ? "Tu" : state.players.find((p) => p.id === id)?.name);
  const by = name(e.by);
  const v = (verb) => (e.by === meId ? verb + "s" : verb);
  if (e.coup) return `COUP FOURRÉ ! ${name(e.coupBy)} ${e.coupBy === meId ? "sors" : "sort"} ${LABEL[e.coupCard.k]}`;
  if (e.finish) return `🏁 ${by} ${v("boucle")} le voyage !`;
  switch (e.kind) {
    case "dist":
      return `${by} ${v("roule")} ${e.card.k} km`;
    case "hazard":
      return `${by} → ${teamName(state, state.players.find((p) => p.id === e.target))} : ${LABEL[e.card.k]} !`;
    case "safety":
      return `Botte : ${LABEL[e.card.k]} (rejoue)`;
    case "discard":
      return `${by} ${v("défausse")}`;
    default:
      return `${by} : ${LABEL[e.card.k]}`;
  }
}

function Banner({ ctrl, state, me }) {
  const e = state.effect;
  const text = bannerText(state, me.id);
  if (!text) return null;
  const shown = e.coup ? e.coupCard.k : e.card.k;
  return (
    <div key={e.id + (e.coup ? "c" : "")} className={`mb-banner ${e.kind} ${e.coup ? "coup" : ""}`}>
      {e.kind !== "discard" && <MbCard k={shown} />}
      <p>{text}</p>
      {state.canCoup && (
        <button className="mb-coup" onClick={() => ctrl.act({ t: "coup" })}>
          COUP FOURRÉ !
          <small>pose ta botte {LABEL[SAFETY_OF[e.card.k]]}</small>
        </button>
      )}
    </div>
  );
}

function Hand({ ctrl, state, me }) {
  const [sel, setSel] = React.useState(null);
  const myTurn = state.turn === me.id && !state.effect;
  React.useEffect(() => setSel(null), [state.turn, state.effect?.id, state.hand.length]);
  const card = state.hand.find((c) => c.id === sel);
  const targets = card ? state.legal[card.id] || [] : [];
  const play = (c, target) => ctrl.act({ t: "play", card: c.id, target });
  const quick = (c) => {
    const t = state.legal[c.id] || [];
    if (myTurn && t.length === 1) play(c, t[0] === "self" ? me.id : t[0]);
  };
  const others = state.players.filter((p) => p.id !== me.id);
  return (
    <div className={"mb-bottom" + (myTurn ? " mine" : "")}>
      {myTurn && card && (
        <div className="mb-actions">
          {targets[0] === "self" && (
            <button className="btn primary" onClick={() => play(card, me.id)}>
              Jouer {LABEL[card.k]}
            </button>
          )}
          {targets[0] !== "self" &&
            targets.map((id) => {
              const p = others.find((o) => o.id === id);
              return (
                <button key={id} className="btn mb-attack" onClick={() => play(card, id)}>
                  {ICON[card.k] === "50" ? "⚠ 50" : ICON[card.k]} sur {teamName(state, p)} <small>{p?.km} km</small>
                </button>
              );
            })}
          {!targets.length && <span className="mb-why">Injouable maintenant</span>}
          <button className="btn ghost" onClick={() => ctrl.act({ t: "discard", card: card.id })}>
            Défausser
          </button>
        </div>
      )}
      <p className="mb-tip">
        {state.effect
          ? "…"
          : myTurn
            ? sel
              ? "Choisis l'action (double-clic = jouer directement)"
              : "À toi : choisis une carte à jouer ou à défausser"
            : `Tour de ${state.players.find((p) => p.id === state.turn)?.name || "…"}`}
      </p>
      <div className="mb-hand">
        {state.hand.map((c) => {
          const legal = (state.legal[c.id] || []).length > 0;
          return (
            <MbCard
              key={c.id}
              k={c.k}
              selected={sel === c.id}
              dim={myTurn && !legal}
              onClick={myTurn ? () => setSel(sel === c.id ? null : c.id) : undefined}
              onDoubleClick={myTurn ? () => quick(c) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function Scoreboard({ ctrl, state, me }) {
  const host = state.hostId === me.id;
  const meP = state.players.find((p) => p.id === me.id) || me;
  const players = [...state.players]
    .filter((p, i, all) => all.findIndex((x) => x.team === p.team) === i)
    .sort((a, b) => b.score - a.score);
  const end = state.phase === "end";
  const champ = state.players.find((p) => p.id === (end ? state.winner : state.roundWinner));
  return (
    <div className="mb-panel panel mb-end">
      <h2>{end ? `🏆 ${teamName(state, champ)} ${champ && state.players.filter((x) => x.team === champ.team).length > 1 ? "remportent" : "remporte"} la course !` : `Fin de la manche ${state.round}`}</h2>
      <p className="sub">
        {state.endReason === "trip" ? "Voyage bouclé." : "Le talon est épuisé."}
        {!end ? ` Premier à ${state.settings.target} points.` : ""}
      </p>
      <div className="mb-score">
        {players.map((p) => (
          <div key={p.id} className={"mb-sc" + (p.team === champ?.team ? " won" : "") + (p.team === meP.team ? " me" : "")}>
            <span className="mb-scn">{teamName(state, p)}</span>
            <small>{p.breakdown.map((b) => `${b.label} ${b.pts}`).join(" · ") || "0 km"}</small>
            <b>
              {state.settings.target > 0 && <em>+{p.handScore} </em>}
              {p.score}
            </b>
          </div>
        ))}
      </div>
      {host ? (
        <div className="row">
          {end ? (
            <button className="btn primary" onClick={() => ctrl.act({ t: "restart" })}>
              Rejouer
            </button>
          ) : (
            <button className="btn primary" onClick={() => ctrl.act({ t: "next" })}>
              Manche suivante
            </button>
          )}
        </div>
      ) : (
        <p className="hint">{end ? "L'hôte peut relancer une course." : "La manche suivante démarre bientôt."}</p>
      )}
    </div>
  );
}

function Log({ log }) {
  return (
    <div className="mb-log">
      {log.slice(-9).map((l) => (
        <p key={l.id} className={l.tone}>
          {l.text}
        </p>
      ))}
    </div>
  );
}

export function MbScreen({ ctrl, state, me, onQuit }) {
  const left = useCountdown(state.deadline);
  const [err, setErr] = React.useState(null);
  const prev = React.useRef({});

  // Bruitages : carte posée, coup fourré, attaque qui frappe, pioche, tour, fin de manche.
  React.useEffect(() => {
    const last = prev.current;
    const e = state.effect;
    if (e && e.id !== last.effectId) e.finish ? (sfx.engine(Number(e.card.k)), setTimeout(sfx.finish, 900)) : playCardSound(e);
    if (e?.coup && !(last.effectId === e.id && last.coup)) sfx.coup();
    if (last.hazard && (!e || e.id !== last.effectId)) {
      const t = state.players.find((p) => p.id === last.hazard.target);
      if (t && (t.battle === last.hazard.k || (last.hazard.k === "limit" && t.limit))) playHazardSound(last.hazard.k);
    }
    if (last.hand !== undefined && state.hand.length > last.hand) sound.card();
    if (last.reshuffles !== undefined && state.reshuffles > last.reshuffles) [0, 90, 180, 270, 360].forEach((d) => setTimeout(sound.card, d));
    if (state.phase === "playing" && state.turn === me.id && last.turn !== me.id) sound.turn();
    if ((state.phase === "end" || state.phase === "roundEnd") && last.phase === "playing") {
      setTimeout(state.roundWinner === me.id || state.winner === me.id ? sound.win : sound.lose, 600);
    }
    prev.current = {
      effectId: e?.id,
      coup: e?.coup,
      hazard: e?.kind === "hazard" && !e.coup ? { target: e.target, k: e.card.k } : null,
      hand: state.hand.length,
      reshuffles: state.reshuffles,
      turn: state.turn,
      phase: state.phase,
    };
  });

  React.useEffect(() => {
    if (!ctrl.lastError) return;
    setErr(ctrl.lastError);
    const t = setTimeout(() => setErr(null), 2200);
    return () => clearTimeout(t);
  }, [ctrl.lastError, ctrl.getSnapshot()]);

  const playing = state.phase === "playing";
  return (
    <div className="mb-root">
      <MbScene
        state={state}
        meId={me.id}
        renderPlate={(members, i, mine, active) => <Plate members={members} index={i} me={mine} active={active} turn={state.turn} />}
      />
      <Header ctrl={ctrl} state={state} onQuit={onQuit} left={left} />
      {state.phase === "lobby" && <Lobby ctrl={ctrl} state={state} me={me} />}
      {playing && (
        <>
          <Banner ctrl={ctrl} state={state} me={me} />
          <Log log={state.log} />
          {state.discardTop && (
            <div className="mb-discard">
              <small>Défausse</small>
              <MbCard k={state.discardTop.k} small />
            </div>
          )}
          {err && <div className="toast mb-toast">{err}</div>}
          <Hand ctrl={ctrl} state={state} me={me} />
        </>
      )}
      {(state.phase === "roundEnd" || state.phase === "end") && <Scoreboard ctrl={ctrl} state={state} me={me} />}
    </div>
  );
}
