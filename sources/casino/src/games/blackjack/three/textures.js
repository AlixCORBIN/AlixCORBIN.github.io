import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { isRedSuit } from "../cards.js";
import { CHIPS } from "../chips.js";
import { TABLE_SIZE, seatPosition } from "./layout.js";

const textureCache = new Map();

const makeCanvas = (w, h) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

const canvasTexture = (canvas, anisotropy = 8) => {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
};

function drawSuit(ctx, suit, x, y, size) {
  ctx.beginPath();
  if (suit === "H") {
    ctx.moveTo(x, y + size * 0.9);
    ctx.bezierCurveTo(
      x - size * 1.5,
      y + size * 0.1,
      x - size * 0.8,
      y - size,
      x,
      y - size * 0.35,
    );
    ctx.bezierCurveTo(
      x + size * 0.8,
      y - size,
      x + size * 1.5,
      y + size * 0.1,
      x,
      y + size * 0.9,
    );
  } else if (suit === "D") {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.7, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.7, y);
    ctx.closePath();
  } else if (suit === "S") {
    ctx.moveTo(x, y - size * 0.95);
    ctx.bezierCurveTo(
      x + size * 1.5,
      y - size * 0.1,
      x + size * 0.8,
      y + size * 0.9,
      x,
      y + size * 0.3,
    );
    ctx.bezierCurveTo(
      x - size * 0.8,
      y + size * 0.9,
      x - size * 1.5,
      y - size * 0.1,
      x,
      y - size * 0.95,
    );
    ctx.moveTo(x, y + size * 0.2);
    ctx.lineTo(x - size * 0.4, y + size * 0.95);
    ctx.lineTo(x + size * 0.4, y + size * 0.95);
    ctx.closePath();
  } else {
    ctx.arc(x, y - size * 0.45, size * 0.42, 0, Math.PI * 2);
    ctx.moveTo(x - size * 0.5 + size * 0.42, y + size * 0.2);
    ctx.arc(x - size * 0.5, y + size * 0.2, size * 0.42, 0, Math.PI * 2);
    ctx.moveTo(x + size * 0.5 + size * 0.42, y + size * 0.2);
    ctx.arc(x + size * 0.5, y + size * 0.2, size * 0.42, 0, Math.PI * 2);
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * 0.4, y + size * 0.95);
    ctx.lineTo(x + size * 0.4, y + size * 0.95);
    ctx.closePath();
  }
  ctx.fill();
}

const PIP_LAYOUT = {
  2: [
    [0, 0],
    [0, 1],
  ],
  3: [
    [0, 0],
    [0, 0.5],
    [0, 1],
  ],
  4: [
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, 0],
    [1, 0],
    [0, 0.5],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, 0],
    [1, 0],
    [-1, 0.5],
    [1, 0.5],
    [-1, 1],
    [1, 1],
  ],
  7: [
    [-1, 0],
    [1, 0],
    [0, 0.25],
    [-1, 0.5],
    [1, 0.5],
    [-1, 1],
    [1, 1],
  ],
  8: [
    [-1, 0],
    [1, 0],
    [0, 0.25],
    [-1, 0.5],
    [1, 0.5],
    [0, 0.75],
    [-1, 1],
    [1, 1],
  ],
  9: [
    [-1, 0],
    [1, 0],
    [-1, 1 / 3],
    [1, 1 / 3],
    [0, 0.5],
    [-1, 2 / 3],
    [1, 2 / 3],
    [-1, 1],
    [1, 1],
  ],
  10: [
    [-1, 0],
    [1, 0],
    [0, 1 / 6],
    [-1, 1 / 3],
    [1, 1 / 3],
    [-1, 2 / 3],
    [1, 2 / 3],
    [0, 5 / 6],
    [-1, 1],
    [1, 1],
  ],
};

const CARD_PX_W = 280;

const CARD_PX_H = 392;

export function cardFaceTexture(card) {
  const key = card.r + card.s;
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = makeCanvas(CARD_PX_W, CARD_PX_H);
  const ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, CARD_PX_W, CARD_PX_H);
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(1, "#efe9db");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, CARD_PX_W, CARD_PX_H, 22);
  ctx.fill();
  ctx.strokeStyle = "#d6cdb8";
  ctx.lineWidth = 3;
  ctx.stroke();
  const ink = isRedSuit(card.s) ? "#c4161c" : "#14161c";
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const rank = card.r;
  const drawCorner = () => {
    ctx.font = `bold ${rank === "10" ? 46 : 54}px Georgia, 'Times New Roman', serif`;
    ctx.fillText(rank, 36, 46);
    drawSuit(ctx, card.s, 36, 92, 17);
  };
  drawCorner();
  ctx.save();
  ctx.translate(CARD_PX_W, CARD_PX_H);
  ctx.rotate(Math.PI);
  drawCorner();
  ctx.restore();
  const left = 78;
  const right = CARD_PX_W - 78;
  const top = 70;
  const bottom = CARD_PX_H - 70;
  if (card.r === "A") drawSuit(ctx, card.s, CARD_PX_W / 2, CARD_PX_H / 2, 62);
  else if (["J", "Q", "K"].includes(card.r)) {
    ctx.save();
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 4;
    ctx.strokeRect(70, 62, CARD_PX_W - 140, CARD_PX_H - 124);
    const face = ctx.createLinearGradient(
      70,
      62,
      CARD_PX_W - 70,
      CARD_PX_H - 62,
    );
    face.addColorStop(0, isRedSuit(card.s) ? "#fbe9e7" : "#e9ecf4");
    face.addColorStop(1, "#fff8e1");
    ctx.fillStyle = face;
    ctx.fillRect(72, 64, CARD_PX_W - 144, CARD_PX_H - 128);
    ctx.fillStyle = ink;
    ctx.font = "bold 120px Georgia, 'Times New Roman', serif";
    ctx.fillText(card.r, CARD_PX_W / 2, CARD_PX_H / 2 - 4);
    drawSuit(ctx, card.s, CARD_PX_W / 2, CARD_PX_H / 2 - 82, 22);
    ctx.translate(CARD_PX_W / 2, CARD_PX_H / 2 + 84);
    ctx.rotate(Math.PI);
    drawSuit(ctx, card.s, 0, 0, 22);
    ctx.restore();
  } else {
    const pips = PIP_LAYOUT[card.r];
    for (const [col, row] of pips) {
      const x = CARD_PX_W / 2 + col * ((right - left) / 2);
      const y = top + row * (bottom - top);
      if (row > 0.5) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI);
        drawSuit(ctx, card.s, 0, 0, 24);
        ctx.restore();
      } else {
        drawSuit(ctx, card.s, x, y, 24);
      }
    }
  }
  const tex = canvasTexture(canvas);
  textureCache.set(key, tex);
  return tex;
}

export function cardBackTexture() {
  if (textureCache.has("back")) return textureCache.get("back");
  const canvas = makeCanvas(CARD_PX_W, CARD_PX_H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4efe2";
  ctx.beginPath();
  ctx.roundRect(0, 0, CARD_PX_W, CARD_PX_H, 22);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(14, 14, CARD_PX_W - 28, CARD_PX_H - 28, 14);
  ctx.clip();
  const grad = ctx.createLinearGradient(0, 0, CARD_PX_W, CARD_PX_H);
  grad.addColorStop(0, "#7a0f2a");
  grad.addColorStop(1, "#3d0716");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_PX_W, CARD_PX_H);
  ctx.strokeStyle = "rgba(232,196,104,.55)";
  ctx.lineWidth = 2;
  for (let x = -CARD_PX_H; x < CARD_PX_W + CARD_PX_H; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + CARD_PX_H, CARD_PX_H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, CARD_PX_H);
    ctx.lineTo(x + CARD_PX_H, 0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#e8c468";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(14, 14, CARD_PX_W - 28, CARD_PX_H - 28, 14);
  ctx.stroke();
  ctx.fillStyle = "#3d0716";
  ctx.beginPath();
  ctx.ellipse(CARD_PX_W / 2, CARD_PX_H / 2, 54, 72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e8c468";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#e8c468";
  drawSuit(ctx, "S", CARD_PX_W / 2, CARD_PX_H / 2, 34);
  const tex = canvasTexture(canvas);
  textureCache.set("back", tex);
  return tex;
}

export function chipTextures(value) {
  const key = "chip" + value;
  if (textureCache.has(key)) return textureCache.get(key);
  const chip = CHIPS.find((c) => c.v === value);
  const topCanvas = makeCanvas(256, 256);
  const ctx = topCanvas.getContext("2d");
  ctx.fillStyle = chip.c;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = chip.e;
  ctx.lineWidth = 16;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(128, 128, 120, (i * Math.PI) / 3 - 0.18, (i * Math.PI) / 3 + 0.18);
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = chip.e;
  ctx.beginPath();
  ctx.arc(128, 128, 88, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = chip.c;
  ctx.font = `bold ${value >= 1000 ? 56 : 84}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), 128, 134);
  const sideCanvas = makeCanvas(256, 32);
  const sctx = sideCanvas.getContext("2d");
  sctx.fillStyle = chip.c;
  sctx.fillRect(0, 0, 256, 32);
  sctx.fillStyle = chip.e;
  for (let i = 0; i < 8; i++) {
    sctx.fillRect(i * 32 + 6, 0, 20, 32);
  }
  const tex = {
    top: canvasTexture(topCanvas),
    side: canvasTexture(sideCanvas),
  };
  tex.side.wrapS = RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

function drawArcText(
  ctx,
  text,
  cx,
  cy,
  radius,
  size,
  spacing,
  color,
  weight = "bold",
) {
  ctx.save();
  ctx.font = `${weight} ${size}px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  let angle = Math.PI / 2 + total / radius / 2;
  [...text].forEach((ch, i) => {
    const a = angle - widths[i] / radius / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle -= widths[i] / radius;
  });
  ctx.restore();
}

export function tableLayoutTexture() {
  if (textureCache.has("table")) return textureCache.get("table");
  const { W, H, D } = TABLE_SIZE;
  const scale = 160;
  const canvas = makeCanvas(W * 2 * scale, (D + H) * scale);
  const ctx = canvas.getContext("2d");
  const px = (x) => (x + W) * scale;
  const pz = (z) => (z + D) * scale;
  const gold = "rgba(232,196,104,.92)";
  const goldSoft = "rgba(232,196,104,.55)";
  const cx = px(0);
  const cy = pz(-3.7);
  ctx.lineWidth = 5;
  ctx.strokeStyle = goldSoft;
  for (const r of [3.55, 2.65]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }
  drawArcText(
    ctx,
    "BLACKJACK PAYS 3 TO 2",
    cx,
    cy,
    3.1 * scale,
    0.36 * scale,
    10,
    gold,
  );
  drawArcText(
    ctx,
    "INSURANCE PAYS 2 TO 1",
    cx,
    cy,
    2.62 * scale - 0,
    0.2 * scale,
    6,
    goldSoft,
    "normal",
  );
  drawArcText(
    ctx,
    "DEALER STANDS ON ALL 17s",
    cx,
    cy,
    3.62 * scale,
    0.17 * scale,
    5,
    goldSoft,
    "normal",
  );
  ctx.strokeStyle = goldSoft;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px(-1.3), pz(-3.05), 2.6 * scale, 1.35 * scale, 20);
  ctx.stroke();
  for (let seat = 0; seat < 5; seat++) {
    const pos = seatPosition(seat);
    const circles = [
      [-0.64, "PP", 0.27],
      [0, "", 0.36],
      [0.64, "21+3", 0.27],
    ];
    ctx.save();
    ctx.translate(px(pos.x), pz(pos.z + 0.35));
    ctx.rotate(pos.rot);
    for (const [dx, label, radius] of circles) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = gold;
      ctx.beginPath();
      ctx.arc(dx * scale, 0, radius * scale, 0, Math.PI * 2);
      ctx.stroke();
      if (label) {
        ctx.fillStyle = goldSoft;
        ctx.font = `bold ${0.14 * scale}px Georgia, serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, dx * scale, 0);
      }
    }
    ctx.restore();
    ctx.save();
    ctx.translate(px(pos.x), pz(pos.z + 0.98));
    ctx.rotate(pos.rot);
    ctx.fillStyle = goldSoft;
    ctx.font = `${0.15 * scale}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(String(seat + 1), 0, 0);
    ctx.restore();
  }
  const tex = canvasTexture(canvas, 16);
  textureCache.set("table", tex);
  return tex;
}

export function feltTexture() {
  if (textureCache.has("felt")) return textureCache.get("felt");
  const canvas = makeCanvas(512, 512);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b5a3c";
  ctx.fillRect(0, 0, 512, 512);
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    img.data[i] += noise;
    img.data[i + 1] += noise;
    img.data[i + 2] += noise;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  textureCache.set("felt", tex);
  return tex;
}
