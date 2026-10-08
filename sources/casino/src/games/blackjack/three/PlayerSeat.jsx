import { Html, Sparkles } from "@react-three/drei";
import { handValue, isNatural } from "../cards.js";
import { Badge } from "./Badge.jsx";
import { Card } from "./Card.jsx";
import { ChipStack } from "./ChipStack.jsx";
import { FELT_Y, seatPosition } from "./layout.js";
import { signed } from "../../../lib/format.js";

const RESULT_LABELS = {
  blackjack: ["BLACKJACK", "#e8c468"],
  win: ["GAGNE", "#6be28f"],
  push: ["EGALITE", "#cbd5e1"],
  lose: ["PERDU", "#ff7a7a"],
  bust: ["BUST", "#ff7a7a"],
};

function handLabel(hand) {
  const { total, soft } = handValue(hand.cards);
  return total > 21
    ? ["BUST", "#ff7a7a"]
    : isNatural(hand)
      ? ["BJ", "#e8c468"]
      : [soft && total < 21 ? `${total - 10}/${total}` : String(total), "#fff"];
}

export function PlayerSeat({ p, index, isMe, g }) {
  const pos = seatPosition(p.seat);
  const handCount = p.hands.length;
  const myTurn =
    g.phase === "playing" && g.turn && g.players[g.turn.p]?.id === p.id;
  const settled = g.phase === "settle";
  const dealtIds = g.players.filter((h) => h.hands.length).map((h) => h.id);
  const dealOrder = dealtIds.indexOf(p.id);
  const cardZ = pos.z - 0.95;
  const celebrate = settled && p.net > 0 && isMe;
  const cardRot = pos.rot * 0.7;
  return (
    <group>
      {p.hands.length === 0 || g.phase === "betting" ? (
        <>
          {p.bet > 0 && (
            <ChipStack
              key={"m" + p.bet}
              position={[pos.x, FELT_Y, pos.z + 0.35]}
              amount={p.bet}
            />
          )}
          {p.pp > 0 && (
            <ChipStack
              key={"p" + p.pp}
              position={[pos.x - 0.64, FELT_Y, pos.z + 0.35]}
              amount={p.pp}
            />
          )}
          {p.t3 > 0 && (
            <ChipStack
              key={"t" + p.t3}
              position={[pos.x + 0.64, FELT_Y, pos.z + 0.35]}
              amount={p.t3}
            />
          )}
        </>
      ) : (
        <>
          {p.hands[0] && (
            <ChipStack
              key={"mm" + p.hands.length + p.hands.map((h) => h.bet).join()}
              position={[pos.x, FELT_Y, pos.z + 0.35]}
              amount={p.hands.reduce((h, hi) => h + hi.bet, 0)}
            />
          )}
          {p.pp > 0 && (
            <ChipStack
              key={"pp" + g.round}
              position={[pos.x - 0.64, FELT_Y, pos.z + 0.35]}
              amount={p.pp}
            />
          )}
          {p.t3 > 0 && (
            <ChipStack
              key={"tt" + g.round}
              position={[pos.x + 0.64, FELT_Y, pos.z + 0.35]}
              amount={p.t3}
            />
          )}
        </>
      )}
      {g.phase === "betting" && p.ready && (
        <Badge position={[pos.x, 0.9, pos.z + 0.35]} color="#6be28f" small>
          PRET
        </Badge>
      )}
      {p.insurance > 0 && (
        <Badge
          position={[pos.x + 0.95, 0.55, cardZ - 0.1]}
          color="#cfe8ff"
          small
        >
          {"ASSURANCE "}
          {p.insurance}
        </Badge>
      )}
      {p.hands.map((h, hi) => {
        const dx =
          handCount === 1
            ? 0
            : handCount === 2
              ? (hi - 0.5) * 1.15
              : ((hi % 2) - 0.5) * 1.15;
        const dz = handCount > 2 ? -Math.floor(hi / 2) * 0.62 + 0.3 : 0;
        const spread = handCount > 1 ? 0.22 : 0.36;
        const active = myTurn && g.turn.h === hi;
        const [label, labelColor] = handLabel(h);
        const result = h.result ? RESULT_LABELS[h.result] : null;
        return (
          <group key={hi}>
            {h.cards.map((card, ci) => {
              const x = pos.x + dx + (ci - (h.cards.length - 1) / 2) * spread;
              const delay =
                ci < 2 && h.cards.length <= 2
                  ? (ci * (dealtIds.length + 1) + dealOrder) * 0.3
                  : 0;
              return (
                <Card
                  key={`${g.round}-${p.id}-${hi}-${ci}`}
                  card={card}
                  target={[
                    x,
                    FELT_Y + 0.01 + ci * 0.012,
                    cardZ + dz - ci * 0.025,
                  ]}
                  rotY={cardRot}
                  delay={delay}
                />
              );
            })}
            {active && (
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[pos.x + dx, FELT_Y + 0.004, cardZ + dz]}
              >
                <ringGeometry args={[0.62, 0.7, 48]} />
                <meshBasicMaterial color="#ffd36a" toneMapped={false} />
              </mesh>
            )}
            <Badge
              position={[pos.x + dx, 0.45, cardZ + dz + 0.72]}
              color={labelColor}
            >
              {label}
            </Badge>
            {result && (
              <Badge
                position={[pos.x + dx, 1.05, cardZ + dz + 0.3]}
                color={result[1]}
                bg="rgba(0,0,0,.78)"
              >
                {result[0]}{" "}
                {h.payout - h.bet !== 0 ? signed(h.payout - h.bet) : ""}
              </Badge>
            )}
          </group>
        );
      })}
      {settled || g.phase !== "betting" ? (
        <>
          {p.side?.pp?.name && (
            <Badge
              position={[pos.x - 0.64, 0.75, pos.z + 0.35]}
              color="#e8c468"
              small
            >
              {p.side.pp.name} {signed(p.side.pp.win)}
            </Badge>
          )}
          {p.side?.t3?.name && (
            <Badge
              position={[pos.x + 0.64, 0.75, pos.z + 0.35]}
              color="#e8c468"
              small
            >
              {p.side.t3.name} {signed(p.side.t3.win)}
            </Badge>
          )}
        </>
      ) : null}
      <Html
        position={[pos.x, 0.3, pos.z + 0.98]}
        center
        zIndexRange={[20, 0]}
        style={{
          pointerEvents: "none",
        }}
      >
        <div
          className={
            "nameplate" + (isMe ? " me" : "") + (myTurn ? " turn" : "")
          }
        >
          <b>{p.name}</b>
          <span>{Math.round(p.bankroll)}</span>
        </div>
      </Html>
      {celebrate && (
        <Sparkles
          count={60}
          scale={[2.4, 1.6, 1.6]}
          size={5}
          speed={0.8}
          color="#ffe08a"
          position={[pos.x, 1, cardZ]}
        />
      )}
    </group>
  );
}
