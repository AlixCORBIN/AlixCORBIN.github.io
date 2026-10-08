import { Vector3 } from "three";

export const TABLE_SIZE = {
  W: 6.8,
  H: 5.2,
  D: 4.4,
};

export const seatPosition = (seat) => {
  const angle = (seat - 2) * 0.42;
  return {
    x: Math.sin(angle) * 5,
    z: 1.65 + Math.cos(angle) * 1.6,
    rot: -angle * 0.55,
  };
};

export const FELT_Y = 0.3;

export const CARD_W = 0.72;

export const CARD_H = 1.02;

export const CARD_THICKNESS = 0.012;

export const SHOE_POS = new Vector3(4.7, 0.9, -2.9);
