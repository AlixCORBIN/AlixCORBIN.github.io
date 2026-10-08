export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const numberColor = (num) =>
  num === 0 ? "green" : RED_NUMBERS.has(num) ? "red" : "black";

export const BETS = (() => {
  const map = new Map();
  const add = (kind, nums, label) => {
    const sorted = [...nums].sort((a, b) => a - b);
    const key =
      kind +
      ":" +
      (kind === "straight" ||
      kind === "split" ||
      kind === "street" ||
      kind === "trio" ||
      kind === "corner" ||
      kind === "line"
        ? sorted.join("-")
        : label);
    map.set(key, {
      key,
      kind,
      nums: sorted,
      mult: 36 / sorted.length - 1,
      label,
    });
  };
  for (let n = 0; n <= 36; n++) {
    add("straight", [n]);
  }
  add("split", [0, 1]);
  add("split", [0, 2]);
  add("split", [0, 3]);
  add("trio", [0, 1, 2]);
  add("trio", [0, 2, 3]);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 3; col++) {
      const n = row * 3 + col + 1;
      if (row < 11) {
        add("split", [n, n + 3]);
      }
      if (col < 2) {
        add("split", [n, n + 1]);
      }
      if (row < 11 && col < 2) {
        add("corner", [n, n + 1, n + 3, n + 4]);
      }
    }
    add("street", [row * 3 + 1, row * 3 + 2, row * 3 + 3]);
    if (row < 11) {
      add("line", [
        row * 3 + 1,
        row * 3 + 2,
        row * 3 + 3,
        row * 3 + 4,
        row * 3 + 5,
        row * 3 + 6,
      ]);
    }
  }
  const range = (from, to) =>
    Array.from(
      {
        length: to - from + 1,
      },
      (_, k) => from + k,
    );
  add("dozen", range(1, 12), "d1");
  add("dozen", range(13, 24), "d2");
  add("dozen", range(25, 36), "d3");
  for (let c = 0; c < 3; c++) {
    add(
      "column",
      range(0, 11).map((k) => k * 3 + c + 1),
      "c" + (c + 1),
    );
  }
  add("low", range(1, 18), "low");
  add("high", range(19, 36), "high");
  add(
    "even",
    range(1, 36).filter((n) => n % 2 === 0),
    "even",
  );
  add(
    "odd",
    range(1, 36).filter((n) => n % 2 === 1),
    "odd",
  );
  add(
    "red",
    range(1, 36).filter((n) => RED_NUMBERS.has(n)),
    "red",
  );
  add(
    "black",
    range(1, 36).filter((n) => !RED_NUMBERS.has(n)),
    "black",
  );
  return map;
})();

export const insideBetKey = (kind, nums) =>
  "split street trio corner line".includes(kind)
    ? kind + ":" + [...nums].sort((a, b) => a - b).join("-")
    : null;

export const ROULETTE_RULES = {
  minChip: 1,
  creditAmount: 500,
  historyLen: 18,
  autoMs: 30000,
  spinMs: 9000,
};
