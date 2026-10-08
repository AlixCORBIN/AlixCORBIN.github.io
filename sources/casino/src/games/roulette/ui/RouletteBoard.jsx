import React from "react";
import { chipFor, shortAmount } from "../chips.js";
import { BETS } from "../rules.js";
import { BOARD_LONG, BOARD_SHORT, buildBoardLayout } from "./boardLayout.js";

export function RouletteBoard({
  orient,
  myBets,
  chip,
  disabled,
  onBet,
  winning,
}) {
  const layout = React.useMemo(() => buildBoardLayout(orient), [orient]);
  const [hover, setHover] = React.useState(null);
  const horiz = layout.h;
  const gridArea = (u0, u1, v0, v1) => ({
    gridColumn: horiz ? `${u0 + 1} / ${u1 + 1}` : `${v0 + 1} / ${v1 + 1}`,
    gridRow: horiz ? `${v0 + 1} / ${v1 + 1}` : `${u0 + 1} / ${u1 + 1}`,
  });
  const spotPos = (u, v) => ({
    left: `${((horiz ? u : v) / (horiz ? BOARD_LONG : BOARD_SHORT)) * 100}%`,
    top: `${((horiz ? v : u) / (horiz ? BOARD_SHORT : BOARD_LONG)) * 100}%`,
  });
  const litNums = hover ? BETS.get(hover)?.nums || [] : [];
  const bet = (key) => {
    if (!disabled) {
      onBet(key);
    }
  };
  return (
    <div
      className={"board " + (horiz ? "h" : "v")}
      style={{
        aspectRatio: horiz
          ? `${BOARD_LONG} / ${BOARD_SHORT}`
          : `${BOARD_SHORT} / ${BOARD_LONG}`,
      }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${horiz ? BOARD_LONG : BOARD_SHORT}, 1fr)`,
          gridTemplateRows: `repeat(${horiz ? BOARD_SHORT : BOARD_LONG}, 1fr)`,
        }}
      >
        {layout.cells.map((cell) => {
          const num = cell.key.startsWith("straight:")
            ? Number(cell.key.slice(9))
            : null;
          const lit = num !== null && litNums.includes(num);
          const win = winning !== null && num === winning;
          return (
            <button
              key={cell.key}
              disabled={disabled}
              className={`cell ${cell.cls} ${lit ? "lit" : ""} ${win ? "win" : ""}`}
              style={gridArea(cell.u0, cell.u1, cell.v0, cell.v1)}
              onMouseEnter={() => setHover(cell.key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => bet(cell.key)}
            >
              <span>{cell.label}</span>
            </button>
          );
        })}
      </div>
      {layout.spots.map((spot) => (
        <button
          key={spot.key}
          className="hot"
          disabled={disabled}
          style={spotPos(spot.u, spot.v)}
          onMouseEnter={() => setHover(spot.key)}
          onMouseLeave={() => setHover(null)}
          onClick={() => bet(spot.key)}
          aria-label={spot.key}
        />
      ))}
      {myBets.map((b) => {
        const at = layout.anchors.get(b.key);
        if (!at) return null;
        const chipStyle = chipFor(b.amount);
        return (
          <div
            key={b.key}
            className="bchip"
            style={{
              ...spotPos(at.u, at.v),
              background: chipStyle.c,
              color: chipStyle.e,
              borderColor: chipStyle.e,
            }}
          >
            {shortAmount(b.amount)}
          </div>
        );
      })}
    </div>
  );
}
