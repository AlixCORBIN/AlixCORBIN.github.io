import React from "react";
import "../../../styles/shuffle.css";

const SHOW_MS = 2600;

// Petite animation quand le sabot est remélangé (compteur de mélanges en hausse).
export function ShuffleNotice({ shuffles }) {
  const last = React.useRef(shuffles);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (shuffles == null) return undefined;
    if (last.current != null && shuffles > last.current) {
      setVisible(true);
      const id = setTimeout(() => setVisible(false), SHOW_MS);
      last.current = shuffles;
      return () => clearTimeout(id);
    }
    last.current = shuffles;
    return undefined;
  }, [shuffles]);
  if (!visible) return null;
  return (
    <div className="shuffle-note" role="status">
      <div className="shuffle-cards" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ "--i": i }} />
        ))}
      </div>
      <b>Sabot remélangé</b>
      <small>Nouveau sabot de 6 jeux</small>
    </div>
  );
}
