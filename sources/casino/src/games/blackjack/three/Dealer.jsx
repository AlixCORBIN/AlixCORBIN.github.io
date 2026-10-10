import { Html } from "@react-three/drei";
import { handValue } from "../cards.js";
import { Badge } from "./Badge.jsx";
import { Card } from "./Card.jsx";
import { FELT_Y } from "./layout.js";

export function Dealer({ g }) {
  const cards = g.dealer.cards;
  const spacing = 0.34;
  const value = handValue(cards);
  const label =
    cards.length === 0
      ? null
      : g.dealer.hidden
        ? String(handValue([cards[0]]).total)
        : value.total > 21
          ? "BUST"
          : String(value.total);
  const players = g.players.filter((p) => p.hands.length).length;
  return (
    <group>
      {cards.map((card, i) => (
        <Card
          key={`${g.round}-d-${i}`}
          card={card}
          hiddenFlip={!!card.hidden}
          target={[
            (i - (cards.length - 1) / 2) * spacing,
            FELT_Y + 0.01 + i * 0.012,
            -2.4,
          ]}
          delay={i === 0 ? players * 0.3 : 0}
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
