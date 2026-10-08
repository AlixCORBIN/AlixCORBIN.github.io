import React from "react";

const NAME_COLORS = ["#ff9f8a", "#8ab8ff", "#9be39f", "#ffd27a", "#c7a2ff", "#7fe0e0", "#ff9fcf", "#e0c08a"];

export function Chat({ state, me, ctrl, open, onToggle }) {
  const channels = state.mine.channels;
  const [tab, setTab] = React.useState("village");
  const [text, setText] = React.useState("");
  const [seen, setSeen] = React.useState({});
  const list = React.useRef(null);
  const current = channels.find((c) => c.ch === tab) || channels[0];
  React.useEffect(() => {
    // La nuit, un loup bascule automatiquement sur le canal de la meute.
    if (state.phase === "night" && channels.some((c) => c.ch === "wolves" && c.write)) setTab("wolves");
    else if (state.phase !== "night") setTab("village");
  }, [state.phase, me.alive]);
  const inTab = (m, ch) => m.ch === ch || (ch === "village" && m.ch.startsWith("p:"));
  const msgs = state.chat.filter((m) => inTab(m, current.ch));
  const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;
  React.useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
    setSeen((s) => ({ ...s, [current.ch]: lastId }));
  }, [lastId, current.ch, open]);
  const unread = (ch) => {
    const last = state.chat.filter((m) => inTab(m, ch)).pop();
    return last && last.id > (seen[ch] || 0) && ch !== current.ch;
  };
  const totalUnread = !open && state.chat.length && state.chat[state.chat.length - 1].id > (seen[current.ch] || 0);
  const send = (e) => {
    e.preventDefault();
    if (!text.trim() || !current.write) return;
    ctrl.act({ t: "chat", ch: current.ch, text });
    setText("");
  };
  const color = (id) => {
    const i = state.players.findIndex((p) => p.id === id);
    return NAME_COLORS[(i < 0 ? 0 : i) % NAME_COLORS.length];
  };
  if (!open)
    return (
      <button className={"ww-chat-fab" + (totalUnread ? " unread" : "")} onClick={onToggle}>
        💬
      </button>
    );
  return (
    <aside className="ww-chat">
      <div className="ww-tabs">
        {channels.map((c) => (
          <button
            key={c.ch}
            className={(c.ch === current.ch ? "on " : "") + c.ch + (unread(c.ch) ? " unread" : "")}
            onClick={() => setTab(c.ch)}
          >
            {c.label}
          </button>
        ))}
        <div className="grow" />
        <button className="ww-x" onClick={onToggle} title="Réduire">
          –
        </button>
      </div>
      <div className="ww-msgs" ref={list}>
        {msgs.map((m) =>
          m.sys ? (
            <div key={m.id} className={"ww-sys " + (m.tone || "") + (m.ch.startsWith("p:") ? " private" : "")}>
              {m.ch.startsWith("p:") && <b>🔒 </b>}
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={"ww-msg" + (m.from === me.id ? " mine" : "")}>
              <b style={{ color: color(m.from) }}>{m.name}</b> {m.text}
            </div>
          ),
        )}
      </div>
      <form className="ww-input" onSubmit={send}>
        <input
          value={text}
          maxLength={240}
          disabled={!current.write}
          placeholder={
            current.write
              ? current.ch === "wolves"
                ? "Chuchoter à la meute..."
                : "Écrire au " + current.label.toLowerCase() + "..."
              : state.phase === "night"
                ? "Le village dort..."
                : "Tu ne peux pas parler ici"
          }
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn primary" disabled={!current.write || !text.trim()}>
          ➤
        </button>
      </form>
    </aside>
  );
}
