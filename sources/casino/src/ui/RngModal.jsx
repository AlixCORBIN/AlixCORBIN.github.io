export function RngModal({ rng, proofPrev, onClose, game = "blackjack" }) {
  const isRandomOrg = rng.source === "random.org";
  const downloadProof = () => {
    const blob = new Blob([JSON.stringify(proofPrev, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `random-org-proof-${game}-${proofPrev.shoeNumber || proofPrev.until || 1}.json`;
    link.click();
  };
  return (
    <div className="modal" onClick={onClose}>
      <div className="panel" onClick={(ev) => ev.stopPropagation()}>
        <h2>Generateur aleatoire</h2>
        <p
          style={{
            textAlign: "left",
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          {"Source du sabot actuel : "}
          <b
            style={{
              color: isRandomOrg ? "#6be28f" : "#ffb870",
            }}
          >
            {isRandomOrg
              ? "random.org (bruit atmospherique)"
              : "crypto.getRandomValues (CSPRNG du navigateur)"}
          </b>
          .<br />
          {game === "roulette"
            ? `Tirage n°${rng.spins}`
            : `Sabot n°${rng.shuffles}`}
          {" · tire a "}
          {new Date(rng.at).toLocaleTimeString()}
          {rng.signed ? " · signature random.org" : ""}.<br />
          {game === "roulette"
            ? "Les numeros sortent par lots de 50 tires chez random.org (0 a 36). Seul le croupier (l'hote) connait les prochains numeros."
            : "Chaque sabot (6 jeux, 312 cartes) est ordonne par 312 nombres tires chez random.org. Seul le croupier (l'hote) connait l'ordre."}
        </p>
        {rng.error && (
          <p
            className="err"
            style={{
              fontSize: 13,
            }}
          >
            {rng.error}
          </p>
        )}
        {proofPrev ? (
          <button className="btn" onClick={downloadProof}>
            Telecharger la preuve du sabot precedent
          </button>
        ) : (
          <p className="hint">
            Une preuve signee est publiee apres chaque re-melange (necessite une
            cle API random.org, voir README).
          </p>
        )}
        <div
          style={{
            height: 10,
          }}
        />
        <button className="btn primary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
