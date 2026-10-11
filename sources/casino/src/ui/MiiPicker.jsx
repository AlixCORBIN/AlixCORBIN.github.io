import React from "react";
import * as THREE from "three";
import { account, listSync, loadPlayMii, miiStore, savePlayMii } from "../lib/mii.js";
import { miiPortrait } from "./MiiAvatar.jsx";
import "../styles/mii.css";

const MII_URL = "../mii/index.html";

function Portrait({ mii, size = 120 }) {
  const url = React.useMemo(() => {
    try {
      return mii ? miiPortrait(THREE, mii, size) : null;
    } catch {
      return null;
    }
  }, [mii && JSON.stringify(mii)]);
  return url ? <img src={url} alt="" draggable="false" /> : <span className="mii-empty">?</span>;
}

// Carte « Ton Mii » du hub : choisir avec quel Mii jouer + état du compte (facultatif)
export function MiiPicker({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [list, setList] = React.useState(listSync);
  const [user, setUser] = React.useState(account?.user || null);
  React.useEffect(() => {
    const refresh = () => {
      const l = listSync();
      setList(l);
      if (!value || !l.some((m) => m.id === value.id)) onChange(loadPlayMii());
      else onChange(l.find((m) => m.id === value.id));
    };
    const off1 = miiStore.subscribe(refresh);
    const off2 = account?.onChange((u) => setUser(u)) || (() => {});
    account?.ready.then(() => setUser(account.user));
    return () => { off1(); off2(); };
  }, [value?.id]);
  const pick = (m) => {
    savePlayMii(m.id);
    onChange(m);
    setOpen(false);
  };
  const who = user ? (account.displayName() || "").split("@")[0] : "";
  return (
    <div className="mii-pick">
      <button className="mii-face" onClick={() => (list.length ? setOpen(!open) : (location.href = MII_URL))} title="Choisir ton Mii">
        <Portrait mii={value} />
        <small>{value ? value.name : "Créer un Mii"}</small>
      </button>
      <div className="mii-acc">
        {user ? (
          <a href={MII_URL + "#account"} className="on">☁ {who || "Connecté"}</a>
        ) : (
          <a href={MII_URL + "#account"}>Compte (facultatif)</a>
        )}
      </div>
      {open && (
        <div className="mii-pop" role="dialog">
          <div className="mii-grid">
            {list.map((m) => (
              <button key={m.id} className={"mii-opt" + (m.id === value?.id ? " on" : "")} onClick={() => pick(m)}>
                <Portrait mii={m} size={96} />
                <span>{m.name}</span>
              </button>
            ))}
          </div>
          <a className="btn" href={MII_URL}>Créer / modifier dans la chaîne Mii</a>
        </div>
      )}
    </div>
  );
}
