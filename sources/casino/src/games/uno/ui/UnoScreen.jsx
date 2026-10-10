import React from "react";
import { COLORS, COLOR_HEX, COLOR_NAME, VALUE_LABEL } from "../cards.js";
import { MAX_PLAYERS, MIN_PLAYERS, TARGETS, TURN_CHOICES } from "../engine.js";
import { UnoScene } from "../three/UnoScene.jsx";
import { sound } from "../../../lib/sound.js";
import "./uno.css";

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
      <div className="brand">🃏 UNO</div>
      {ctrl.code && (
        <button className="pill" onClick={copy} title="Copier le lien d'invitation">
          Salle <b>{ctrl.code}</b> · {copied ? "copié !" : "copier le lien"}
        </button>
      )}
      <div className="grow" />
      {state.phase !== "lobby" && (
        <div className="pill un-round">
          Manche {state.round}
          {state.settings.target > 0 ? ` · objectif ${state.settings.target}` : ""}
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
    <div className="un-panel panel">
      <h2>Table de UNO</h2>
      <p className="sub">
        {n}/{MAX_PLAYERS} joueurs · minimum {MIN_PLAYERS} (complété par des bots)
        {ctrl.code ? " · partage le code de salle pour inviter" : ""}
      </p>
      <div className="un-plist">
        {state.players.map((p) => (
          <div key={p.id} className={"un-pl" + (p.id === me.id ? " me" : "")}>
            <span>
              {p.id === state.hostId ? "👑 " : ""}
              {p.name}
            </span>
            <em>{p.bot ? "bot" : "prêt"}</em>
          </div>
        ))}
      </div>
      {host ? (
        <>
          <div className="un-settings">
            <label className="un-opt">
              <span>Partie en</span>
              <select value={s.target} onChange={(e) => set({ target: +e.target.value })}>
                {TARGETS.map((t) => (
                  <option key={t} value={t}>
                    {t === 0 ? "une manche" : `${t} points`}
                  </option>
                ))}
              </select>
            </label>
            <label className="un-opt">
              <span>Temps par tour</span>
              <select value={s.turnMs} onChange={(e) => set({ turnMs: +e.target.value })}>
                {TURN_CHOICES.map((t) => (
                  <option key={t} value={t}>
                    {t === 0 ? "illimité" : `${t / 1000} s`}
                  </option>
                ))}
              </select>
            </label>
            <button className={"un-tg" + (s.stack ? " on" : "")} onClick={() => set({ stack: !s.stack })}>
              Cumul des +2 / +4 {s.stack ? "activé" : "désactivé"}
            </button>
            <p className="hint">
              {s.stack
                ? "Un +2 se pare par un +2, un +4 par un +4. Le défi du +4 est désactivé."
                : "Règles officielles : pas de cumul, le +4 peut être défié."}
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
              Lancer la partie
            </button>
          </div>
        </>
      ) : (
        <p className="hint">L'hôte lance la partie quand tout le monde est là.</p>
      )}
    </div>
  );
}

function ColorPicker({ onPick, onCancel }) {
  return (
    <div className="modal soft" onClick={onCancel}>
      <div className="panel un-color" onClick={(e) => e.stopPropagation()}>
        <h2>Choisis une couleur</h2>
        <div className="un-colors">
          {COLORS.map((c) => (
            <button key={c} style={{ background: COLOR_HEX[c] }} onClick={() => onPick(c)}>
              {COLOR_NAME[c]}
            </button>
          ))}
        </div>
        <button className="link" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function Scoreboard({ ctrl, state, me }) {
  const host = state.hostId === me.id;
  const players = [...state.players].sort((a, b) => b.score - a.score);
  const winner = state.players.find((p) => p.id === (state.phase === "end" ? state.winner : state.roundWinner));
  const target = state.settings.target;
  return (
    <div className="un-panel panel un-end">
      <h2>{state.phase === "end" ? `🏆 ${winner?.name} gagne la partie !` : `${winner?.name} gagne la manche`}</h2>
      <p className="sub">
        {state.phase === "end" && target === 0
          ? `Il marque ${state.roundPts} points avec les cartes restantes des autres.`
          : `+${state.roundPts} points pour ${winner?.name}.`}
        {state.phase === "roundEnd" ? ` Premier à ${target} points.` : ""}
      </p>
      <div className="un-score">
        {players.map((p) => (
          <div key={p.id} className={"un-sc" + (p.id === winner?.id ? " won" : "") + (p.id === me.id ? " me" : "")}>
            <span>
              {p.bot ? "🤖 " : ""}
              {p.name}
            </span>
            <small>{p.count} carte{p.count > 1 ? "s" : ""}</small>
            <b>{p.score}</b>
          </div>
        ))}
      </div>
      {host ? (
        <div className="row">
          {state.phase === "roundEnd" ? (
            <button className="btn primary" onClick={() => ctrl.act({ t: "next" })}>
              Manche suivante
            </button>
          ) : (
            <button className="btn primary" onClick={() => ctrl.act({ t: "restart" })}>
              Rejouer
            </button>
          )}
        </div>
      ) : (
        <p className="hint">{state.phase === "roundEnd" ? "La manche suivante démarre bientôt." : "L'hôte peut relancer une partie."}</p>
      )}
    </div>
  );
}

function Log({ log }) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);
  return (
    <div className="un-log" ref={ref}>
      {log.slice(-12).map((l) => (
        <p key={l.id} className={l.tone}>
          {l.text}
        </p>
      ))}
    </div>
  );
}

/** Texte du bandeau affiché entre la pose d'une carte et son effet. */
function effectText(state) {
  const e = state.effect;
  if (!e) return null;
  const n = state.players.length;
  const idx = state.players.findIndex((p) => p.id === e.by);
  const by = state.players[idx];
  const next = state.players[(((idx + state.dir) % n) + n) % n];
  if (e.last) return `${by.name} pose sa dernière carte !`;
  switch (e.v) {
    case "skip":
      return `⊘ ${next.name} passe son tour`;
    case "rev":
      return "⇄ Le sens du jeu s'inverse";
    case "d2":
      return state.settings.stack ? `+2 cumulable, ${next.name} peut parer` : `+2 : ${next.name} pioche 2 cartes`;
    case "wd4":
      return state.settings.stack ? `+4 cumulable, ${next.name} peut parer` : `+4 : ${next.name} pioche ou défie`;
    case "wild":
      return `Joker : couleur ${COLOR_NAME[state.color]}`;
    default:
      return null;
  }
}

function ActionBar({ ctrl, state, me }) {
  const myTurn = state.turn === me.id;
  const chal = state.challenge;
  const from = chal ? state.players.find((p) => p.id === chal.from) : null;
  const stack = state.pending > 0;
  const act = (a) => ctrl.act(a);
  let body = null;
  if (state.effect) {
    const by = state.players.find((p) => p.id === state.effect.by);
    body = <p>{by?.id === me.id ? "Tu poses ta carte…" : `${by?.name} pose une carte…`}</p>;
  } else if (chal && chal.to === me.id) {
    body = (
      <>
        <p>
          <b>{from?.name}</b> joue un +4 en choisissant <b style={{ color: COLOR_HEX[state.color] }}>{COLOR_NAME[state.color]}</b>.
        </p>
        <div className="row">
          <button className="btn act stand" onClick={() => act({ t: "challenge" })}>
            Défier
            <small>6 cartes si raté</small>
          </button>
          <button className="btn act hit" onClick={() => act({ t: "accept" })}>
            Piocher 4
          </button>
        </div>
      </>
    );
  } else if (chal) {
    body = (
      <p>
        {state.players.find((p) => p.id === chal.to)?.name} décide de défier le +4…
      </p>
    );
  } else if (myTurn && state.drawn != null) {
    body = (
      <div className="row">
        <p className="grow">Tu peux jouer la carte piochée.</p>
        <button className="btn act stand" onClick={() => act({ t: "pass" })}>
          Passer
        </button>
      </div>
    );
  } else if (myTurn) {
    body = (
      <div className="row">
        <p className="grow">
          {stack
            ? `Cumul de ${state.pending} : joue un ${VALUE_LABEL[state.pendingType]} ou pioche.`
            : state.playable.length
              ? "À toi de jouer !"
              : "Aucune carte jouable : pioche."}
        </p>
        <button className="btn act hit" onClick={() => act({ t: "draw" })}>
          {stack ? `Piocher ${state.pending}` : "Piocher"}
        </button>
      </div>
    );
  } else {
    const cur = state.players.find((p) => p.id === state.turn);
    body = <p>Tour de {cur?.name}…</p>;
  }
  const mine = !state.effect && (myTurn || chal?.to === me.id);
  return <div className={"dock un-dock" + (mine ? " mine" : " slim")}>{body}</div>;
}

export function UnoScreen({ ctrl, state, me, onQuit }) {
  if (import.meta.env.DEV) window.__unoCtrl = ctrl; // hook de test, absent du build de production
  const left = useCountdown(state.deadline);
  const [picker, setPicker] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const prev = React.useRef({});

  React.useEffect(() => {
    const last = prev.current;
    const total = state.players.reduce((s, p) => s + p.count, 0);
    if (last.discard !== undefined && (state.discard.length !== last.discard || total !== last.total)) sound.card();
    if (state.phase === "playing" && state.turn === me.id && last.turn !== me.id) sound.turn();
    if ((state.phase === "end" || state.phase === "roundEnd") && last.phase !== state.phase) {
      (state.roundWinner === me.id || state.winner === me.id ? sound.win : sound.lose)();
    }
    prev.current = { discard: state.discard.length, total, turn: state.turn, phase: state.phase };
  });

  React.useEffect(() => {
    if (!ctrl.lastError) return;
    setErr(ctrl.lastError);
    const t = setTimeout(() => setErr(null), 2200);
    return () => clearTimeout(t);
  }, [ctrl.lastError, ctrl.getSnapshot()]);

  const onPlay = (card) => {
    if (card.c === "w") setPicker(card);
    else ctrl.act({ t: "play", card: card.id });
  };
  const pickColor = (color) => {
    ctrl.act({ t: "play", card: picker.id, color });
    setPicker(null);
  };

  const playing = state.phase === "playing";
  const showUno = playing && me.count <= 2 && !me.uno;

  return (
    <div className="un-root">
      <UnoScene
        state={state}
        meId={me.id}
        onPlay={onPlay}
        onDraw={() => ctrl.act({ t: "draw" })}
        onCatch={(id) => ctrl.act({ t: "catch", target: id })}
      />
      <Header ctrl={ctrl} state={state} onQuit={onQuit} left={left} />
      {state.phase === "lobby" && <Lobby ctrl={ctrl} state={state} me={me} />}
      {playing && (
        <>
          <div className="un-color-pill" style={{ "--c": COLOR_HEX[state.color] }}>
            <i /> {COLOR_NAME[state.color]}
            {state.pending > 0 && <b> · +{state.pending}</b>}
          </div>
          {effectText(state) && (
            <div key={state.effect.by + state.discard.length} className="un-effect">
              {effectText(state)}
            </div>
          )}
          <Log log={state.log} />
          <div className="un-bottom">
            {err && <div className="toast">{err}</div>}
            <ActionBar ctrl={ctrl} state={state} me={me} />
          </div>
          <div className="un-me">
            <b>{me.name}</b>
            <span>
              {me.count} carte{me.count > 1 ? "s" : ""}
              {state.settings.target > 0 ? ` · ${me.score} pts` : ""}
            </span>
          </div>
          {(showUno || me.uno) && (
            <button className={"un-uno" + (me.uno ? " done" : "")} disabled={me.uno} onClick={() => ctrl.act({ t: "uno" })}>
              UNO !
            </button>
          )}
        </>
      )}
      {(state.phase === "roundEnd" || state.phase === "end") && <Scoreboard ctrl={ctrl} state={state} me={me} />}
      {picker && <ColorPicker onPick={pickColor} onCancel={() => setPicker(null)} />}
    </div>
  );
}
