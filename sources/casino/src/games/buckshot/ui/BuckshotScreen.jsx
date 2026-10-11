import React from "react";
import { ITEMS } from "../items.js";
import { MAX_PLAYERS, ROUNDS, TURN_CHOICES, CUT_AT } from "../engine.js";
import { BuckshotScene } from "../three/BuckshotScene.jsx";
import { ADRENALINE_LEAD, ITEM, SHOT, shownHp, useEventTime } from "../three/layout.js";
import { sfx, startAmbience } from "../sfx.js";
import { sound } from "../../../lib/sound.js";
import "./buckshot.css";

const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;

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

/* ---------- sons calés sur les animations ---------- */
function useSounds(state, meId, muted) {
  const ev = state.event;
  React.useEffect(() => (muted ? undefined : startAmbience()), [muted]);
  React.useEffect(() => {
    if (!ev) return;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const target = state.players.find((p) => p.id === ev.target);
    switch (ev.type) {
      case "round":
        sfx.roundStart();
        at(900, sfx.charge);
        [2000, 2600, 3200].forEach((ms) => at(ms, () => sfx.ecg()));
        break;
      case "deal": {
        const most = Math.max(0, ...Object.values(ev.gifts).map((l) => l.length));
        for (let k = 0; k < most; k++) at(300 + k * 380 + 420, () => sfx.itemDrop());
        break;
      }
      case "show":
        for (let i = 0; i < ev.live + ev.blank; i++) at(300 + i * 260 + 200, sfx.shellPlace);
        break;
      case "load": {
        const step = 2500 / ev.n;
        for (let i = 0; i < ev.n; i++) at(250 + i * step + step * 0.8, sfx.shellInsert);
        at(2950, sfx.pump);
        break;
      }
      case "shot":
        at(SHOT.lift, sfx.grab);
        at(SHOT.aim, () => sfx.heartbeat(2, 0.42));
        at(SHOT.fire, ev.live ? sfx.fire : sfx.click);
        if (ev.live) at(SHOT.fire + 90, sfx.hit);
        if (ev.live && target && target.hp - ev.dmg <= 0) at(SHOT.fire + 800, sfx.flatline);
        at(SHOT.pump, sfx.pump);
        at(SHOT.land, sfx.shellBounce);
        break;
      case "skip":
        at(250, sfx.menottes);
        break;
      case "item": {
        const base = ev.item === "adrenaline" ? ADRENALINE_LEAD : 0;
        const it = ev.item === "adrenaline" ? ev.sub : ev;
        if (ev.item === "adrenaline") at(350, sfx.adrenaline);
        at(base + 80, sfx.grab);
        at(base + ITEM.fx, () => sfx[it.item]?.(it.lucky));
        if (it.item === "biere") {
          at(base + 1200, sfx.pump);
          at(base + 1700, sfx.shellBounce);
        }
        if (it.item === "medicament" && !it.lucky && state.players.find((p) => p.id === it.by)?.hp <= 1) at(base + 1700, sfx.flatline);
        break;
      }
      default:
    }
    return () => timers.forEach(clearTimeout);
  }, [ev?.id]);

  const prev = React.useRef({});
  React.useEffect(() => {
    const myTurn = state.phase === "playing" && !state.event && state.turn === meId;
    if (myTurn && !prev.current.myTurn) sfx.turn();
    if (state.phase !== prev.current.phase && (state.phase === "roundEnd" || state.phase === "end")) {
      const won = state.phase === "end" ? state.winner === meId : state.roundWinner === meId;
      setTimeout(won ? sfx.win : sfx.lose, 600);
    }
    prev.current = { myTurn, phase: state.phase };
  });
}

/* ---------- bandeau d'annonce ---------- */
function banner(state, meId, t) {
  const ev = state.event;
  if (!ev) return null;
  const nm = (id) => (id === meId ? "Tu" : state.players.find((p) => p.id === id)?.name || "?");
  const name = (id) => (id === meId ? "toi" : state.players.find((p) => p.id === id)?.name || "?");
  switch (ev.type) {
    case "round":
      return {
        big: `Manche ${ev.round}`,
        small: `${plural(ev.hp, "charge")} chacun · ${ev.items ? `${plural(ev.items, "objet")} par chargement` : "aucun objet"}${ev.round === ROUNDS.length ? ` · câbles coupés à ${CUT_AT} charges` : ""}`,
        cls: "round",
      };
    case "deal":
      return { small: ev.lost?.[meId] ? `Plateau plein : ${plural(ev.lost[meId], "objet")} perdu${ev.lost[meId] > 1 ? "s" : ""}` : "Distribution des objets" };
    case "show":
      return { big: <><span className="live">{plural(ev.live, "réelle")}</span> · <span className="blank">{ev.blank} à blanc</span></>, cls: "show" };
    case "load":
      return { small: "Les cartouches sont chargées dans un ordre inconnu…" };
    case "shot": {
      const self = ev.by === ev.target;
      if (t < SHOT.fire) {
        const who = ev.by === meId ? "Tu vises" : `${nm(ev.by)} vise`;
        return { small: `${who} ${self ? (ev.by === meId ? "ta propre tête" : "sa propre tête") : name(ev.target)}${ev.saw ? " · canon scié" : ""}…`, cls: "aim" };
      }
      return ev.live ? { big: ev.dmg > 1 ? "RÉELLE ! −2" : "RÉELLE !", cls: "hit" } : { big: "Clic. À blanc.", small: self ? `${ev.by === meId ? "Tu rejoues" : `${nm(ev.by)} rejoue`}` : null, cls: "blank" };
    }
    case "skip":
      return { small: `${ev.who === meId ? "Tu es menotté : tu passes ton tour" : `${nm(ev.who)} est menotté et passe son tour`}` };
    case "item": {
      const it = ev.item === "adrenaline" ? ev.sub : ev;
      const base = ev.item === "adrenaline" ? ADRENALINE_LEAD : 0;
      const head =
        ev.item === "adrenaline"
          ? `${ev.by === meId ? "Tu voles" : `${nm(ev.by)} vole`} ${ITEMS[it.item].name} à ${name(ev.target)}`
          : `${ev.by === meId ? "Tu utilises" : `${nm(ev.by)} utilise`} ${ITEMS[ev.item].name}${ev.target && ev.item === "menottes" ? ` sur ${name(ev.target)}` : ""}`;
      let reveal = null;
      const tt = t - base;
      if (tt > ITEM.go) {
        if (it.priv?.live !== undefined && it.item === "loupe") reveal = it.priv.live ? <span className="live">Cartouche engagée : RÉELLE</span> : <span className="blank">Cartouche engagée : À BLANC</span>;
        if (it.item === "telephone" && it.priv) reveal = it.priv.none ? "« Dommage… »" : <>« Cartouche n°{it.priv.pos} : {it.priv.live ? <span className="live">réelle</span> : <span className="blank">à blanc</span>} »</>;
        if (it.item === "medicament") reveal = it.lucky ? <span className="heal">+{it.gain} charge{it.gain > 1 ? "s" : ""}</span> : <span className="live">Périmé : −1 charge</span>;
        if (it.item === "cigarettes") reveal = it.gain ? <span className="heal">+1 charge</span> : "Sans effet";
      }
      if (it.item === "biere" && tt > 1400) reveal = it.live ? <span className="live">Éjectée : RÉELLE</span> : <span className="blank">Éjectée : à blanc</span>;
      return { small: head, big: reveal, cls: "item" };
    }
    default:
      return null;
  }
}

/* ---------- panneaux ---------- */
function Header({ ctrl, state, onQuit, left, muted, setMuted }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${ctrl.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <header className="topbar bs-top">
      <div className="brand">☠ Buckshot</div>
      {ctrl.code && (
        <button className="pill" onClick={copy} title="Copier le lien d'invitation">
          Salle <b>{ctrl.code}</b> · {copied ? "copié !" : "copier le lien"}
        </button>
      )}
      <div className="grow" />
      {state.phase !== "lobby" && (
        <div className="pill">
          Manche {state.round}/{ROUNDS.length}
          {left !== null && <b className={left <= 8 ? "hurry" : ""}> {left}s</b>}
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
  const n = state.players.length;
  return (
    <div className="bs-panel">
      <h2>Buckshot</h2>
      <p className="sub">
        {n}/{MAX_PLAYERS} joueurs · seul, tu affrontes le Croupier
        {ctrl.code ? " · partage le code de salle pour inviter" : ""}
      </p>
      <div className="bs-plist">
        {state.players.map((p) => (
          <div key={p.id} className={"bs-pl" + (p.id === me.id ? " me" : "")}>
            <span>
              {p.id === state.hostId ? "👑 " : ""}
              {p.name}
            </span>
            <em>{p.bot ? "bot" : "prêt"}</em>
          </div>
        ))}
      </div>
      <ul className="bs-rules">
        <li>Le fusil contient des cartouches <b className="live">réelles</b> et <b className="blank">à blanc</b>, montrées puis chargées dans un ordre inconnu.</li>
        <li>À ton tour, tire sur un adversaire ou sur toi. Une cartouche à blanc sur toi : tu rejoues.</li>
        <li>3 manches (2, 4 puis 6 charges). Objets dès la manche 2. Le premier à 2 manches gagne.</li>
      </ul>
      {host ? (
        <>
          <label className="bs-opt">
            <span>Temps par tour</span>
            <select value={state.settings.turnMs} onChange={(e) => ctrl.act({ t: "settings", patch: { turnMs: +e.target.value } })}>
              {TURN_CHOICES.map((t) => (
                <option key={t} value={t}>
                  {t === 0 ? "illimité" : `${t / 1000} s`}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <button className="btn ghost" disabled={n >= MAX_PLAYERS} onClick={() => ctrl.act({ t: "addBot" })}>
              + Bot
            </button>
            <button className="btn ghost" disabled={!state.players.some((p) => p.bot)} onClick={() => ctrl.act({ t: "removeBot" })}>
              − Bot
            </button>
            <button className="btn primary" onClick={() => ctrl.act({ t: "start" })}>
              S'asseoir à la table
            </button>
          </div>
        </>
      ) : (
        <p className="hint">L'hôte lance la partie quand tout le monde est là.</p>
      )}
    </div>
  );
}

function EndPanel({ ctrl, state, me, left }) {
  const host = state.hostId === me.id;
  const end = state.phase === "end";
  const w = state.players.find((p) => p.id === (end ? state.winner : state.roundWinner));
  const mine = w?.id === me.id;
  return (
    <div className="bs-panel bs-end">
      <h2>{end ? (mine ? "Tu survis. Partie gagnée." : `${w?.name} gagne la partie`) : mine ? `Manche ${state.round} remportée` : `${w?.name} remporte la manche ${state.round}`}</h2>
      <div className="bs-score">
        {[...state.players]
          .sort((a, b) => b.wins - a.wins)
          .map((p) => (
            <div key={p.id} className={"bs-sc" + (p.id === w?.id ? " won" : "") + (p.id === me.id ? " me" : "")}>
              <span>
                {p.bot ? "🤖 " : ""}
                {p.name}
              </span>
              <b>{"★".repeat(p.wins) || "·"}</b>
            </div>
          ))}
      </div>
      {end ? (
        host ? (
          <button className="btn primary" onClick={() => ctrl.act({ t: "restart" })}>
            Rejouer
          </button>
        ) : (
          <p className="hint">L'hôte peut relancer une partie.</p>
        )
      ) : (
        <div className="row">
          <p className="hint grow">Manche suivante{left !== null ? ` dans ${left}s` : ""}…</p>
          {host && (
            <button className="btn primary" onClick={() => ctrl.act({ t: "next" })}>
              Continuer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Choix d'une cible (menottes) ou d'un objet à voler (adrénaline)
function Picker({ state, me, pick, onDone, onCancel }) {
  const [victim, setVictim] = React.useState(null);
  const others = state.players.filter((p) => p.alive && p.id !== me.id);
  const adr = pick.item === "adrenaline";
  const list = adr ? others.filter((p) => p.items.some((it) => it !== "adrenaline")) : others.filter((p) => !p.cuffed);
  return (
    <div className="modal soft" onClick={onCancel}>
      <div className="bs-panel bs-pick" onClick={(e) => e.stopPropagation()}>
        {!victim ? (
          <>
            <h3>{adr ? "À qui voler un objet ?" : "Qui menotter ?"}</h3>
            <div className="bs-choices">
              {list.map((p) => (
                <button key={p.id} className="btn" onClick={() => (adr ? setVictim(p) : onDone({ target: p.id }))}>
                  {p.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3>Voler quel objet à {victim.name} ?</h3>
            <div className="bs-choices">
              {victim.items.map((it, k) =>
                it === "adrenaline" ? null : (
                  <button key={k} className="btn bs-item" title={ITEMS[it].desc} onClick={() => onDone({ target: victim.id, steal: k })}>
                    <span>{ITEMS[it].icon}</span>
                    {ITEMS[it].name}
                  </button>
                ),
              )}
            </div>
          </>
        )}
        <button className="link" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function Chamber({ state }) {
  if (!state.loadInfo || state.phase !== "playing") return null;
  const known = state.myKnow.some((k) => k !== null);
  return (
    <div className="bs-chamber">
      <span>
        Fusil : <b>{plural(state.shellCount, "cartouche")}</b>
        {state.saw && <em> · canon scié</em>}
      </span>
      {known && (
        <span className="bs-pips" title="Ce que tu sais (1 = engagée)">
          {state.myKnow.map((k, i) => (
            <i key={i} className={k === null ? "" : k ? "live" : "blank"}>
              {i + 1}
            </i>
          ))}
        </span>
      )}
      {state.spent.length > 0 && (
        <span className="bs-pips spent" title="Cartouches déjà sorties">
          {state.spent.map((l, i) => (
            <i key={i} className={l ? "live" : "blank"} />
          ))}
        </span>
      )}
    </div>
  );
}

export function BuckshotScreen({ ctrl, state, me, onQuit }) {
  if (import.meta.env.DEV) window.__bsCtrl = ctrl;
  const [muted, setMuted] = React.useState(sound.isMuted());
  const left = useCountdown(state.deadline);
  const t = useEventTime(state.event);
  const [pick, setPick] = React.useState(null);
  const [err, setErr] = React.useState(null);
  useSounds(state, me.id, muted);

  React.useEffect(() => {
    if (!ctrl.lastError) return;
    setErr(ctrl.lastError);
    const tm = setTimeout(() => setErr(null), 2200);
    return () => clearTimeout(tm);
  }, [ctrl.lastError, ctrl.getSnapshot()]);

  const ev = state.event;
  const playing = state.phase === "playing";
  const myTurn = playing && !ev && state.turn === me.id && me.alive;
  const others = state.players.filter((p) => p.alive && p.id !== me.id);
  const b = banner(state, me.id, t);
  const hp = shownHp(me, ev, t);
  const cur = state.players.find((p) => p.id === state.turn);

  const useItem = (idx) => {
    const it = me.items[idx];
    if (it === "menottes") {
      const c = others.filter((p) => !p.cuffed);
      if (c.length === 1) return ctrl.act({ t: "item", idx, target: c[0].id });
      return setPick({ item: it, idx });
    }
    if (it === "adrenaline") return setPick({ item: it, idx });
    ctrl.act({ t: "item", idx });
  };
  const disabled = (it) =>
    (it === "scie" && state.saw) ||
    (it === "telecommande" && others.length < 2) ||
    (it === "menottes" && !others.some((p) => !p.cuffed)) ||
    (it === "adrenaline" && !others.some((p) => p.items.some((x) => x !== "adrenaline")));

  return (
    <div className="bs-root">
      <BuckshotScene state={state} meId={me.id} />
      <div className="bs-vignette" />
      {ev?.type === "shot" && ev.live && ev.target === me.id && <div key={ev.id} className="bs-hitflash" />}
      <Header ctrl={ctrl} state={state} onQuit={onQuit} left={playing ? left : null} muted={muted} setMuted={setMuted} />
      {state.phase === "lobby" && <Lobby ctrl={ctrl} state={state} me={me} />}
      {b && (
        <div key={ev.id + (ev.type === "shot" && t >= SHOT.fire ? ":f" : "")} className={"bs-banner " + (b.cls || "")}>
          {b.big && <div className="big">{b.big}</div>}
          {b.small && <div className="small">{b.small}</div>}
        </div>
      )}
      {playing && (
        <>
          <Chamber state={state} />
          <div className="bs-log">
            {state.log.slice(-8).map((l) => (
              <p key={l.id} className={l.tone}>
                {l.text}
              </p>
            ))}
          </div>
          <div className="bs-bottom">
            {err && <div className="toast">{err}</div>}
            <div className={"bs-me" + (myTurn ? " turn" : "") + (!me.alive ? " dead" : "")}>
              <b>{me.name}</b>
              <span className={"bs-bolts big" + (me.cut ? " cut" : "")}>
                {Array.from({ length: me.maxHp }, (_, i) => (
                  <i key={i} className={i < hp ? "on" : ""} />
                ))}
              </span>
              <small>
                {!me.alive ? "☠ hors jeu pour cette manche" : me.cut ? "câbles coupés : plus de soin" : ""}
                {me.cuffed ? " ⛓ menotté" : ""}
                {me.wins ? ` ${"★".repeat(me.wins)}` : ""}
              </small>
            </div>
            {myTurn ? (
              <div className="dock bs-dock mine">
                <p>À toi. Tire, ou utilise un objet d'abord.</p>
                <div className="bs-shoot">
                  <button className="btn bs-self" onClick={() => ctrl.act({ t: "shoot", target: me.id })}>
                    Sur moi
                    <small>à blanc : je rejoue</small>
                  </button>
                  {others.map((p) => (
                    <button key={p.id} className="btn bs-fire" onClick={() => ctrl.act({ t: "shoot", target: p.id })}>
                      Sur {p.name}
                      <small>{p.hp} charge{p.hp > 1 ? "s" : ""}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              !ev && cur && <div className="dock bs-dock slim">{cur.id === me.id ? "…" : `Tour de ${cur.name}…`}</div>
            )}
            {me.items.length > 0 && (
              <div className="bs-items">
                {me.items.map((it, k) => (
                  <button key={k} className="bs-item" disabled={!myTurn || disabled(it)} onClick={() => useItem(k)} title={ITEMS[it].desc}>
                    <span>{ITEMS[it].icon}</span>
                    <small>{ITEMS[it].name}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {(state.phase === "roundEnd" || state.phase === "end") && <EndPanel ctrl={ctrl} state={state} me={me} left={left} />}
      {pick && (
        <Picker
          state={state}
          me={me}
          pick={pick}
          onCancel={() => setPick(null)}
          onDone={(o) => {
            ctrl.act({ t: "item", idx: pick.idx, ...o });
            setPick(null);
          }}
        />
      )}
    </div>
  );
}
