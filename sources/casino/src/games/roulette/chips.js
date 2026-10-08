export const ROULETTE_CHIPS = [
  {
    v: 1,
    c: "#e8e8ec",
    e: "#555",
  },
  {
    v: 5,
    c: "#b3202a",
    e: "#fbe0e2",
  },
  {
    v: 25,
    c: "#14804a",
    e: "#d9f3e4",
  },
  {
    v: 50,
    c: "#1d5fa8",
    e: "#dbe9fa",
  },
  {
    v: 100,
    c: "#1b1b1f",
    e: "#d6d6dc",
  },
  {
    v: 500,
    c: "#6a2c91",
    e: "#e9d8f5",
  },
  {
    v: 1000,
    c: "#a87a12",
    e: "#fff3c4",
  },
];

export const chipFor = (amount) =>
  [...ROULETTE_CHIPS].reverse().find((c) => c.v <= amount) || ROULETTE_CHIPS[0];

export const shortAmount = (v) =>
  v >= 10000
    ? `${Math.round(v / 1000)}k`
    : v >= 1000
      ? `${(v / 1000).toFixed(1).replace(".0", "")}k`
      : String(v);
