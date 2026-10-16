import React from "react";
import * as THREE from "three";
import { GUEST_MIIS, account, listSync, loadPlayMii, miiStore, savePlayMii } from "../lib/mii.js";
import { miiPortrait } from "./MiiAvatar.jsx";
import { getThumb, peekThumb, putThumb, thumbKey } from "@mii/thumb-cache.js";
import "../styles/mii.css";

const MII_URL = "../mii/index.html";

// Portrait mis en cache (IndexedDB, partagé avec la chaîne Mii) : rendu 3D seulement la première fois
function Portrait({ mii, size = 120 }) {
  const key = mii ? thumbKey(mii, "casino", size) : null;
  const [url, setUrl] = React.useState(() => (key ? peekThumb(key) : null));
  React.useEffect(() => {
    if (!key) return setUrl(null);
    let alive = true;
    const hit = peekThumb(key);
    if (hit) return setUrl(hit);
    getThumb(key).then((stored) => {
      if (!alive) return;
      if (stored) return setUrl(stored);
      try {
        const fresh = miiPortrait(THREE, mii, size);
        putThumb(key, fresh);
        setUrl(fresh);
      } catch {
        setUrl(null);
      }
    });
    return () => { alive = false; };
  }, [key]);
  return url ? <img src={url} alt="" draggable="false" /> : <span className="mii-empty mii-wait" />;
}

// Grille de choix du Mii (utilisée par le menu Compte du hub)
export function MiiChooser({ value, onPick }) {
  const [list, setList] = React.useState(listSync);
  React.useEffect(() => miiStore.subscribe(() => setList(listSync())), []);
  return (
    <>
      {list.length > 0 && <h4 className="mii-sec">Tes Mii</h4>}
      {list.length > 0 && (
        <div className="mii-grid">
          {list.map((m) => (
            <button key={m.id} className={"mii-opt" + (m.id === value?.id ? " on" : "")} onClick={() => onPick(m)}>
              <Portrait mii={m} size={96} />
              <span>{m.name}</span>
            </button>
          ))}
        </div>
      )}
      <h4 className="mii-sec">Mii invités</h4>
      <div className="mii-grid">
        {GUEST_MIIS.map((m) => (
          <button key={m.id} className={"mii-opt" + (m.id === value?.id ? " on" : "")} onClick={() => onPick(m)}>
            <Portrait mii={m} size={96} />
            <span>{m.name}</span>
          </button>
        ))}
      </div>
      <a className="btn" href={MII_URL}>Créer ton propre Mii dans la chaîne Mii</a>
    </>
  );
}
export { Portrait as MiiPortrait };

// Carte « Ton Mii » du hub : choisir avec quel Mii jouer + état du compte (facultatif)
export function MiiPicker({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [list, setList] = React.useState(listSync);
  const [user, setUser] = React.useState(account?.user || null);
  React.useEffect(() => {
    const refresh = () => {
      const l = listSync();
      setList(l);
      const all = [...l, ...GUEST_MIIS];
      if (!value || !all.some((m) => m.id === value.id)) onChange(loadPlayMii());
      else onChange(all.find((m) => m.id === value.id));
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
      <button className="mii-face" onClick={() => setOpen(!open)} title="Choisir ton Mii">
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
          {list.length > 0 && <h4 className="mii-sec">Tes Mii</h4>}
          {list.length > 0 && (
            <div className="mii-grid">
              {list.map((m) => (
                <button key={m.id} className={"mii-opt" + (m.id === value?.id ? " on" : "")} onClick={() => pick(m)}>
                  <Portrait mii={m} size={96} />
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          )}
          <h4 className="mii-sec">Mii invités</h4>
          <div className="mii-grid">
            {GUEST_MIIS.map((m) => (
              <button key={m.id} className={"mii-opt" + (m.id === value?.id ? " on" : "")} onClick={() => pick(m)}>
                <Portrait mii={m} size={96} />
                <span>{m.name}</span>
              </button>
            ))}
          </div>
          <a className="btn" href={MII_URL}>Créer ton propre Mii dans la chaîne Mii</a>
        </div>
      )}
    </div>
  );
}
