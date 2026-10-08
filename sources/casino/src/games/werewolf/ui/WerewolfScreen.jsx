import React from "react";
import { Chat } from "./Chat.jsx";
import { MAX_PLAYERS, MIN_PLAYERS, ROLES, SPECIALS, STEP_LABEL, autoWolves, buildDeck } from "../roles.js";
import { VillageScene } from "../three/VillageScene.jsx";
import { sound } from "../../../lib/sound.js";
import "./werewolf.css";

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
  const phase =
    state.phase === "lobby"
      ? "Rassemblement"
      : state.phase === "night"
        ? `🌙 Nuit ${state.day} · ${STEP_LABEL[state.step] || ""}`
        : state.phase === "day"
          ? `☀️ Jour ${state.day} · Débat et vote`
          : state.phase === "hunter"
            ? "🏹 Le Chasseur tire"
            : "Fin de partie";
  return (
    <header className="topbar ww-top">
      <div className="brand">🐺 Loup-Garou</div>
      {ctrl.code && (
        <button className="pill" onClick={copy} title="Copier le lien d'invitation">
          Salle <b>{ctrl.code}</b> · {copied ? "copié !" : "copier le lien"}
        </button>
      )}
      <div className="grow" />
      <div className={"pill ww-phase ph-" + state.phase}>
        {phase}
        {left !== null && <b className={left <= 10 ? "hurry" : ""}> {left}s</b>}
      </div>
      {state.phase !== "lobby" && (
        <span className={"pill rng " + (state.rng.source === "random.org" ? "ok" : "warn")} title="Tirage des rôles">
          <i /> rôles {state.rng.source === "random.org" ? "random.org" : "local"}
        </span>
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

function RoomPanel({ ctrl, state, me }) {
  const host = state.hostId === me.id;
  const s = state.settings;
  const n = state.players.length;
  const deck = buildDeck(Math.max(n, MIN_PLAYERS), s);
  const set = (patch) => ctrl.act({ t: "settings", patch });
  return (
    <div className="ww-room panel">
      <h2>Le village se rassemble</h2>
      <p className="sub">
        {n}/{MAX_PLAYERS} joueurs · minimum {MIN_PLAYERS} (complété par des bots)
        {ctrl.code ? " · partage le code de salle pour inviter" : ""}
      </p>
      <div className="ww-plist">
        {state.players.map((p) => (
          <div key={p.id} className={"ww-pl" + (p.id === me.id ? " me" : "")}>
            <span>
              {p.id === state.hostId ? "👑 " : ""}
              {p.name}
              {p.bot ? " 🤖" : ""}
            </span>
            <em className={p.ready ? "pos" : ""}>{p.bot ? "bot" : p.ready ? "prêt" : "..."}</em>
          </div>
        ))}
      </div>
      {host ? (
        <>
          <div className="ww-settings">
            <div className="ww-roles">
              {SPECIALS.map((r) => (
                <button key={r} className={"ww-role-tg" + (s[r] ? " on" : "")} onClick={() => set({ [r]: !s[r] })}>
                  {ROLES[r].icon} {ROLES[r].name}
                </button>
              ))}
            </div>
            <div className="ww-row">
              <span>Loups</span>
              <button className="btn ghost sm" onClick={() => set({ wolves: Math.max(0, (s.wolves || autoWolves(n)) - 1) })}>
                −
              </button>
              <b>{s.wolves || `auto (${autoWolves(Math.max(n, MIN_PLAYERS))})`}</b>
              <button className="btn ghost sm" onClick={() => set({ wolves: (s.wolves || autoWolves(n)) + 1 })}>
                +
              </button>
              <span className="sp" />
              <span>Débat</span>
              <select value={s.dayMs} onChange={(e) => set({ dayMs: +e.target.value })}>
                {[60000, 90000, 120000, 180000, 240000].map((v) => (
                  <option key={v} value={v}>
                    {v / 60000} min
                  </option>
                ))}
              </select>
            </div>
            <p className="hint">
              Distribution : {deck.map((r) => ROLES[r].icon).join(" ")}
            </p>
          </div>
          <div className="row">
            <button className="btn ghost" disabled={n >= MAX_PLAYERS} onClick={() => ctrl.act({ t: "addBot" })}>
              + Bot
            </button>
            <button className="btn ghost" disabled={!state.players.some((p) => p.bot)} onClick={() => ctrl.act({ t: "removeBot" })}>
              − Bot
            </button>
            <button className="btn primary" disabled={state.starting} onClick={() => ctrl.act({ t: "start" })}>
              {state.starting ? "Distribution..." : "Lancer la partie"}
            </button>
          </div>
        </>
      ) : (
        <div className="row">
          <button className={"btn " + (me.ready ? "" : "primary")} onClick={() => ctrl.act({ t: "ready", v: !me.ready })}>
            {me.ready ? "Pas prêt" : "Je suis prêt"}
          </button>
        </div>
      )}
      {!host && <p className="hint">L'hôte lance la partie quand tout le monde est là.</p>}
    </div>
  );
}

function RoleCard({ state, me }) {
  const [open, setOpen] = React.useState(true);
  if (!me.role) return null;
  const r = ROLES[me.role];
  const lover = state.players.find((p) => p.lover && p.id !== me.id);
  const mates = me.role === "wolf" ? state.players.filter((p) => p.role === "wolf" && p.id !== me.id) : [];
  return (
    <div className={"ww-card" + (open ? "" : " mini")} style={{ "--rc": r.color }} onClick={() => setOpen(!open)}>
      <div className="ic">{r.icon}</div>
      <div className="tx">
        <small>{me.alive ? "Ton rôle" : "Tu étais"}</small>
        <b>{r.name}</b>
        {open && (
          <>
            <p>{r.desc}</p>
            {mates.length > 0 && <p className="extra">Meute : {mates.map((p) => p.name).join(", ")}</p>}
            {lover && me.lover && <p className="extra">💘 Amoureux de {lover.name}</p>}
            {state.mine.potions && me.role === "witch" && (
              <p className="extra">
                Potions : {state.mine.potions.life ? "❤️ vie" : "✗"} · {state.mine.potions.death ? "☠️ mort" : "✗"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ActionDock({ ctrl, state, me, sel, setSel, witch, setWitch }) {
  const nameOf = (id) => state.players.find((p) => p.id === id)?.name || "?";
  const host = state.hostId === me.id;
  if (state.phase === "night") {
    const myTurn = state.mine.myTurn;
    if (!me.alive) return <div className="dock slim"><p>👻 Tu observes la nuit depuis le cimetière.</p></div>;
    if (!myTurn) return <div className="dock slim"><p>😴 Tu dors... {STEP_LABEL[state.step]}.</p></div>;
    switch (state.step) {
      case "cupid":
        return (
          <div className="dock">
            <p>💘 Choisis deux amoureux ({sel.length}/2)</p>
            <button className="btn primary" disabled={sel.length !== 2} onClick={() => ctrl.act({ t: "night", targets: sel })}>
              Unir {sel.map(nameOf).join(" et ")}
            </button>
          </div>
        );
      case "guard":
      case "seer":
        return (
          <div className="dock">
            <p>{state.step === "guard" ? "🛡️ Qui protèges-tu cette nuit ?" : "🔮 Quel joueur veux-tu sonder ?"}</p>
            <button className="btn primary" disabled={sel.length !== 1} onClick={() => ctrl.act({ t: "night", target: sel[0] })}>
              {sel.length ? (state.step === "guard" ? "Protéger " : "Sonder ") + nameOf(sel[0]) : "Clique sur un joueur"}
            </button>
          </div>
        );
      case "wolves": {
        const mine = state.mine.wolfVotes?.[me.id];
        return (
          <div className="dock slim">
            <p>🐺 {mine ? `Ta proie : ${nameOf(mine)}. La meute doit se décider.` : "Clique sur ta proie. Discute avec la meute dans le chat."}</p>
          </div>
        );
      }
      case "witch": {
        const v = state.mine.victim;
        const p = state.mine.potions || {};
        return (
          <div className="dock">
            <p>🧪 {v ? `Les loups ont attaqué ${nameOf(v)}.` : "Personne n'a été attaqué."}</p>
            <div className="row">
              {v && p.life && (
                <button className={"btn " + (witch.save ? "primary" : "ghost")} onClick={() => setWitch({ ...witch, save: !witch.save })}>
                  ❤️ {witch.save ? "Sauvé" : "Sauver"}
                </button>
              )}
              {p.death && (
                <button className={"btn " + (witch.kill ? "primary" : "ghost")} onClick={() => setWitch({ ...witch, kill: !witch.kill })}>
                  ☠️ {witch.kill ? (sel[0] ? "Empoisonner " + nameOf(sel[0]) : "Choisis une cible") : "Empoisonner"}
                </button>
              )}
              <button
                className="btn primary"
                disabled={witch.kill && !sel[0]}
                onClick={() => ctrl.act({ t: "night", save: witch.save, kill: witch.kill ? sel[0] : null })}
              >
                {witch.save || witch.kill ? "Valider" : "Ne rien faire"}
              </button>
            </div>
          </div>
        );
      }
    }
  }
  if (state.phase === "day") {
    const mine = state.votes[me.id];
    const voted = Object.keys(state.votes).length;
    const alive = state.players.filter((p) => p.alive).length;
    return (
      <div className="dock">
        <p>
          {me.alive
            ? mine
              ? `🗳️ Tu votes contre ${nameOf(mine)}`
              : "🗳️ Clique sur un joueur pour voter contre lui"
            : "👻 Les morts ne votent pas."}{" "}
          <span className="hint">({voted}/{alive} votes)</span>
        </p>
        <div className="row">
          {me.alive && mine && (
            <button className="btn ghost" onClick={() => ctrl.act({ t: "vote", target: null })}>
              Retirer mon vote
            </button>
          )}
          {host && (
            <button className="btn ghost" onClick={() => ctrl.act({ t: "endDay" })}>
              Clore le vote
            </button>
          )}
        </div>
      </div>
    );
  }
  if (state.phase === "hunter") {
    if (state.hunter !== me.id)
      return <div className="dock slim"><p>🏹 {nameOf(state.hunter)} choisit sa cible...</p></div>;
    return (
      <div className="dock">
        <p>🏹 Tu meurs, mais tu peux emporter quelqu'un avec toi.</p>
        <button className="btn primary" disabled={!sel[0]} onClick={() => ctrl.act({ t: "shoot", target: sel[0] })}>
          {sel[0] ? "Tirer sur " + nameOf(sel[0]) : "Clique sur ta cible"}
        </button>
      </div>
    );
  }
  return null;
}

function EndPanel({ ctrl, state, me }) {
  const title = {
    village: "🎉 Victoire du village",
    wolves: "🐺 Victoire des loups-garous",
    lovers: "💘 Victoire des amoureux",
    none: "Le village est désert",
  }[state.winner];
  const mine = state.players.find((p) => p.id === me.id);
  return (
    <div className="ww-end panel">
      <h2>{title}</h2>
      <p className={"net " + (mine?.won ? "pos" : "neg")}>{mine?.won ? "Tu as gagné !" : "Tu as perdu"}</p>
      <div className="ww-plist">
        {state.players.map((p) => (
          <div key={p.id} className={"ww-pl" + (p.won ? " won" : "")}>
            <span>
              {p.alive ? "" : "💀 "}
              {p.lover ? "💘 " : ""}
              {p.name}
            </span>
            <em style={{ color: ROLES[p.role]?.color }}>
              {ROLES[p.role]?.icon} {ROLES[p.role]?.name}
            </em>
          </div>
        ))}
      </div>
      {state.hostId === me.id ? (
        <button className="btn primary" onClick={() => ctrl.act({ t: "restart" })}>
          Nouvelle partie
        </button>
      ) : (
        <p className="hint">En attente de l'hôte pour une nouvelle partie.</p>
      )}
    </div>
  );
}

export function WerewolfScreen({ ctrl, state, me, onQuit }) {
  const left = useCountdown(state.deadline);
  const [sel, setSel] = React.useState([]);
  const [witch, setWitch] = React.useState({ save: false, kill: false });
  const [chatOpen, setChatOpen] = React.useState(() => window.innerWidth > 760);
  const stepKey = `${state.phase}|${state.step}|${state.day}|${state.hunter}`;
  React.useEffect(() => {
    setSel([]);
    setWitch({ save: false, kill: false });
  }, [stepKey]);

  React.useEffect(() => {
    if (!ctrl.lastError) return;
    const t = setTimeout(() => {
      ctrl.lastError = null;
      ctrl.emit();
    }, 2500);
    return () => clearTimeout(t);
  }, [ctrl.lastError]);

  // Sons
  const prev = React.useRef({});
  React.useEffect(() => {
    const p = prev.current;
    if (p.key !== undefined && p.key !== stepKey) {
      if (state.mine.myTurn && state.phase !== "day") sound.turn();
      if (state.phase === "day" && p.phase === "night") sound.win();
    }
    if (p.alive && !me.alive) sound.lose();
    if (p.phase !== "end" && state.phase === "end" && p.phase) {
      (state.players.find((x) => x.id === me.id)?.won ? sound.win : sound.lose)();
    }
    const lastMsg = state.chat[state.chat.length - 1];
    if (p.msg && lastMsg && lastMsg.id !== p.msg && !lastMsg.sys && lastMsg.from !== me.id) sound.chip();
    prev.current = { key: stepKey, alive: me.alive, phase: state.phase, msg: lastMsg?.id };
  });

  // Joueurs cliquables selon le contexte
  const alive = state.players.filter((p) => p.alive);
  let pickable = [];
  let multi = 1;
  let instant = null;
  if (me.alive && state.mine.myTurn) {
    if (state.phase === "night") {
      if (state.step === "cupid") {
        pickable = alive.map((p) => p.id);
        multi = 2;
      } else if (state.step === "guard") pickable = alive.filter((p) => p.id !== state.mine.lastGuard).map((p) => p.id);
      else if (state.step === "seer") pickable = alive.filter((p) => p.id !== me.id).map((p) => p.id);
      else if (state.step === "wolves") {
        pickable = alive.filter((p) => p.role !== "wolf").map((p) => p.id);
        instant = (id) => ctrl.act({ t: "night", target: id });
      } else if (state.step === "witch" && witch.kill) pickable = alive.filter((p) => p.id !== me.id).map((p) => p.id);
    } else if (state.phase === "day") {
      pickable = alive.filter((p) => p.id !== me.id).map((p) => p.id);
      instant = (id) => ctrl.act({ t: "vote", target: id });
    }
  }
  if (state.phase === "hunter" && state.hunter === me.id) pickable = alive.filter((p) => p.id !== me.id).map((p) => p.id);

  const onPick = (id) => {
    if (!id) return;
    if (!pickable.includes(id)) return;
    sound.chip();
    if (instant) return instant(id);
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : multi === 1 ? [id] : [...s, id].slice(-multi)));
  };
  const selected =
    state.phase === "day"
      ? [state.votes[me.id]].filter(Boolean)
      : state.step === "wolves"
        ? [state.mine.wolfVotes?.[me.id]].filter(Boolean)
        : sel;

  // Bulles de dialogue au-dessus des personnages
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const bubbles = {};
  for (const m of state.chat) {
    if (!m.sys && m.from && (m.ch === "village" || m.ch === "wolves") && now - m.at < 6000) bubbles[m.from] = m.text;
  }

  return (
    <div className={"ww-root ph-" + state.phase}>
      <VillageScene state={state} meId={me.id} pickable={pickable} selected={selected} onPick={onPick} bubbles={bubbles} />
      <Header ctrl={ctrl} state={state} onQuit={onQuit} left={left} />
      {state.phase === "lobby" && <RoomPanel ctrl={ctrl} state={state} me={me} />}
      {state.phase === "end" && <EndPanel ctrl={ctrl} state={state} me={me} />}
      {state.phase !== "lobby" && state.phase !== "end" && (
        <>
          <RoleCard state={state} me={me} />
          <div className="ww-dock-wrap">
            <ActionDock ctrl={ctrl} state={state} me={me} sel={sel} setSel={setSel} witch={witch} setWitch={setWitch} />
            {pickable.length > 0 && (
              <div className="ww-picks">
                {pickable.map((id) => (
                  <button key={id} className={"pill" + (selected.includes(id) ? " on" : "")} onClick={() => onPick(id)}>
                    {state.players.find((p) => p.id === id)?.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <Chat state={state} me={me} ctrl={ctrl} open={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
      {ctrl.lastError && <div className="ww-err">{ctrl.lastError}</div>}
    </div>
  );
}
