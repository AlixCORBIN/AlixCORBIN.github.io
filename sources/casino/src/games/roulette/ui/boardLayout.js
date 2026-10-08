import { BETS, insideBetKey, numberColor } from "../rules.js";

export const BOARD_LONG = 14;

export const BOARD_SHORT = 5;

export function buildBoardLayout(orient) {
  const horizontal = orient === "h";
  const numAt = (row, col) =>
    horizontal ? row * 3 + 3 - col : row * 3 + col + 1;
  const cells = [];
  const spots = [];
  const anchors = new Map();
  const addCell = (key, label, u0, u1, v0, v1, cls = "") => {
    cells.push({
      key,
      label,
      u0,
      u1,
      v0,
      v1,
      cls,
    });
    anchors.set(key, {
      u: (u0 + u1) / 2,
      v: (v0 + v1) / 2,
    });
  };
  const addSpot = (kind, nums, u, v) => {
    const key = insideBetKey(kind, nums);
    if (!(!key || !BETS.has(key))) {
      spots.push({
        key,
        u,
        v,
      });
      anchors.set(key, {
        u,
        v,
      });
    }
  };
  addCell("straight:0", "0", 0, 1, 0, 3, "zero");
  for (let row = 0; row < 12; row++)
    for (let col = 0; col < 3; col++) {
      const num = numAt(row, col);
      addCell(
        `straight:${num}`,
        String(num),
        row + 1,
        row + 2,
        col,
        col + 1,
        numberColor(num),
      );
    }
  for (let i = 0; i < 3; i++) {
    addCell(
      "column:" + (horizontal ? "c" + (3 - i) : "c" + (i + 1)),
      "2:1",
      13,
      14,
      i,
      i + 1,
      "outside",
    );
  }
  [
    ["d1", "1re 12"],
    ["d2", "2e 12"],
    ["d3", "3e 12"],
  ].forEach(([key, label], i) =>
    addCell("dozen:" + key, label, 1 + i * 4, 5 + i * 4, 3, 4, "outside"),
  );
  [
    ["low", "1-18", ""],
    ["even", "PAIR", ""],
    ["red", "ROUGE", "redbet"],
    ["black", "NOIR", "blackbet"],
    ["odd", "IMPAIR", ""],
    ["high", "19-36", ""],
  ].forEach(([key, label, cls], i) =>
    addCell(
      `${key}:${key}`,
      label,
      1 + i * 2,
      3 + i * 2,
      4,
      5,
      "outside " + cls,
    ),
  );
  const streetV = horizontal ? 3 : 0;
  for (let c = 0; c < 3; c++) {
    addSpot("split", [0, numAt(0, c)], 1, c + 0.5);
  }
  addSpot("trio", [0, numAt(0, 0), numAt(0, 1)], 1, 1);
  addSpot("trio", [0, numAt(0, 1), numAt(0, 2)], 1, 2);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 3; col++) {
      if (row < 11) {
        addSpot(
          "split",
          [numAt(row, col), numAt(row + 1, col)],
          row + 2,
          col + 0.5,
        );
      }
      if (col < 2) {
        addSpot(
          "split",
          [numAt(row, col), numAt(row, col + 1)],
          row + 1.5,
          col + 1,
        );
      }
      if (row < 11 && col < 2) {
        addSpot(
          "corner",
          [
            numAt(row, col),
            numAt(row, col + 1),
            numAt(row + 1, col),
            numAt(row + 1, col + 1),
          ],
          row + 2,
          col + 1,
        );
      }
    }
    const street = [0, 1, 2].map((c) => numAt(row, c));
    addSpot("street", street, row + 1.5, streetV);
    if (row < 11) {
      addSpot(
        "line",
        [...street, ...[0, 1, 2].map((c) => numAt(row + 1, c))],
        row + 2,
        streetV,
      );
    }
  }
  return {
    cells,
    spots,
    anchors,
    h: horizontal,
  };
}
