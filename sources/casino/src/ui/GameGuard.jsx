import React from "react";

// La 3D (WebGL) est-elle disponible dans ce navigateur ?
export function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// Un jeu qui plante (souvent : 3D indisponible) affiche un message au lieu de vider toute la page (écran noir).
// need3d : le jeu est en 3D dès son ouverture, on vérifie WebGL avant de le lancer.
export class GameGuard extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("Jeu interrompu :", error); }
  render() {
    const { error } = this.state;
    if (!error && (!this.props.need3d || webglOk())) return this.props.children;
    const noGl = !webglOk();
    return (
      <div className="center-screen">
        <div className="panel">
          <h2>{noGl ? "3D indisponible" : "Le jeu a planté"}</h2>
          {noGl ? (
            <p className="sub">
              Ton navigateur n'arrive pas à démarrer la 3D (WebGL). Sur Firefox : Paramètres › Général › Performances,
              coche « Utiliser l'accélération graphique si disponible », puis redémarre Firefox. Si ça ne suffit pas, ouvre
              <b> about:config</b> et mets <b>webgl.disabled</b> à false, <b>webgl.force-enabled</b> à true, et
              <b> privacy.resistFingerprinting</b> à false.
            </p>
          ) : (
            <p className="sub">{String(error?.message || error)}</p>
          )}
          <button className="btn primary" onClick={() => { this.setState({ error: null }); this.props.onQuit?.(); }}>Retour au menu</button>
        </div>
      </div>
    );
  }
}
