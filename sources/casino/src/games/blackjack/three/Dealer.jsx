import { Html } from "@react-three/drei";
import { handValue } from "../cards.js";
import { Badge } from "./Badge.jsx";
import { Card } from "./Card.jsx";
import { FELT_Y } from "./layout.js";
import { useArrival } from "./useArrival.js";

export function Dealer({ g }) {
  const cards = g.dealer.cards;
  const spacing = 0.34;
  const players = g.players.filter((p) => p.hands.length).length;
  const keys = cards.map((_, i) => `${g.round}-d-${i}`);
  const delays = cards.map((_, i) => (i === 0 ? players * 0.3 : 0));
  const arrived = useArrival(keys, delays);
  const value = handValue(cards.slice(0, arrived));
  const label =
    arrived === 0 ? null : value.total > 21 ? "BUST" : String(value.total);
  return (
    <group>
      {cards.map((card, i) => (
        <Card
          key={keys[i]}
          card={card}
          hiddenFlip={!!card.hidden}
          target={[
            (i - (cards.length - 1) / 2) * spacing,
            FELT_Y + 0.01 + i * 0.012,
            -2.4,
          ]}
          delay={delays[i]}
        />
      ))}
      {label && (
        <Badge
          position={[0, 0.45, -1.8]}
          color={label === "BUST" ? "#ff7a7a" : "#fff"}
        >
          {label}
        </Badge>
      )}
      <Html
        position={[0, 0.3, -3.3]}
        center
        zIndexRange={[20, 0]}
        style={{
          pointerEvents: "none",
        }}
      >
        <div className="dealer-tag">CROUPIER</div>
      </Html>
    </group>
  );
}
