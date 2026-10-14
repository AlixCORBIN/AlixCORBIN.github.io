import React from "react";
import { DEFAULTS, getSettings, setSettings, subscribeSettings } from "../settings.js";
import { getEngineVolume, setEngineVolume } from "../audio.js";

function Slider({ label, hint, min, max, step, value, onChange, fmt }) {
  return (
    <label className="rc-set">
      <span><b>{label}</b><em>{fmt(value)}</em></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

// Fenêtre Paramètres : sensibilité clavier / manette, zone morte, volume du moteur
export function Settings({ onClose }) {
  const [s, setS] = React.useState(getSettings);
  const [vol, setVol] = React.useState(getEngineVolume);
  React.useEffect(() => subscribeSettings(setS), []);
  const pct = (v) => `${Math.round(v * 100)} %`;
  return (
    <div className="modal" onClick={onClose}>
      <div className="panel rc-settings" onClick={(e) => e.stopPropagation()}>
        <h2>⚙ Paramètres</h2>
        <h3>⌨ Clavier</h3>
        <Slider label="Sensibilité de direction" min={0.25} max={3} step={0.05} value={s.kbSens} fmt={(v) => (v >= 3 ? "instantanée" : `×${v.toFixed(2)}`)}
          hint="Vitesse à laquelle les roues tournent quand tu appuies sur ← →. Bas = plus doux, max = direction instantanée."
          onChange={(v) => setSettings({ kbSens: v })} />
        <h3>🎮 Manette</h3>
        <Slider label="Sensibilité du stick" min={0.5} max={2} step={0.05} value={s.padSens} fmt={(v) => `×${v.toFixed(2)}`}
          hint="Au-dessus de ×1, la butée est atteinte sans pousser le stick à fond."
          onChange={(v) => setSettings({ padSens: v })} />
        <Slider label="Zone morte" min={0} max={0.35} step={0.01} value={s.padDead} fmt={pct}
          hint="Augmente-la si la voiture tourne toute seule (stick qui dérive)."
          onChange={(v) => setSettings({ padDead: v })} />
        <h3>🔊 Son</h3>
        <Slider label="Volume du moteur" min={0} max={1} step={0.01} value={vol} fmt={pct} onChange={(v) => { setVol(v); setEngineVolume(v); }} />
        <div className="row">
          <button className="btn ghost" onClick={() => setSettings({ ...DEFAULTS })}>Valeurs par défaut</button>
          <button className="btn primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
