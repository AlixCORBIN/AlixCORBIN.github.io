import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from "three";
import { COLOR_HEX, faceKey } from "../cards.js";

const W = 512;
const H = 768;
const textures = new Map();
const materials = new Map();

const makeCanvas = (w, h) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

const toTexture = (canvas) => {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function arrow(ctx, x, y, angle, size, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, size * 0.12);
  ctx.lineTo(-size * 0.55, -size * 0.12);
  ctx.lineTo(size * 0.05, -size * 0.12);
  ctx.lineTo(size * 0.05, -size * 0.38);
  ctx.lineTo(size * 0.6, 0);
  ctx.lineTo(size * 0.05, size * 0.38);
  ctx.lineTo(size * 0.05, size * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function miniCard(ctx, x, y, w, h, angle, fill, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  roundRect(ctx, -w / 2, -h / 2, w, h, w * 0.14);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = w * 0.09;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

/** Symbole d'une valeur, centré en (x, y), tenant dans un carré de côté `size`. */
function glyph(ctx, v, x, y, size, fill, edge) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (v === "skip") {
    ctx.lineWidth = size * 0.17;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - size * 0.25, y + size * 0.25);
    ctx.lineTo(x + size * 0.25, y - size * 0.25);
    ctx.stroke();
  } else if (v === "rev") {
    arrow(ctx, x + size * 0.04, y - size * 0.2, -0.45, size * 0.95, fill);
    arrow(ctx, x - size * 0.04, y + size * 0.2, Math.PI - 0.45, size * 0.95, fill);
  } else if (v === "d2") {
    miniCard(ctx, x - size * 0.13, y + size * 0.04, size * 0.4, size * 0.58, -0.22, fill, edge);
    miniCard(ctx, x + size * 0.13, y - size * 0.04, size * 0.4, size * 0.58, 0.18, fill, edge);
  } else if (v === "wd4") {
    const cols = [COLOR_HEX.b, COLOR_HEX.g, COLOR_HEX.r, COLOR_HEX.y];
    const pos = [
      [-0.2, -0.1, -0.35],
      [0.0, 0.1, -0.1],
      [0.2, -0.08, 0.12],
      [0.0, -0.18, 0.4],
    ];
    cols.forEach((c, i) =>
      miniCard(ctx, x + size * pos[i][0], y + size * pos[i][1], size * 0.34, size * 0.5, pos[i][2], c, "#fff"),
    );
  } else if (v !== "wild") {
    ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    ctx.fillText(v, x, y + size * 0.04);
    if (v === "6" || v === "9") {
      ctx.fillRect(x - size * 0.2, y + size * 0.42, size * 0.4, size * 0.07);
    }
  }
  ctx.restore();
}

const corner = (v) => (v === "skip" ? "⊘" : v === "rev" ? "⇄" : v === "d2" ? "+2" : v === "wd4" ? "+4" : v === "wild" ? "" : v);

function wildOval(ctx) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.38);
  ctx.beginPath();
  ctx.ellipse(0, 0, 150, 270, 0, 0, Math.PI * 2);
  ctx.clip();
  const quad = [COLOR_HEX.r, COLOR_HEX.y, COLOR_HEX.g, COLOR_HEX.b];
  quad.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i % 2 === 0 ? -200 : 0, i < 2 ? -300 : 0, 200, 300);
  });
  ctx.restore();
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.38);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, 0, 150, 270, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFace(card) {
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const color = COLOR_HEX[card.c];
  ctx.fillStyle = "#fbfaf5";
  roundRect(ctx, 0, 0, W, H, 44);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, 26, 26, W - 52, H - 52, 30);
  ctx.fill();

  if (card.c === "w") {
    wildOval(ctx);
    if (card.v === "wd4") glyph(ctx, "wd4", W / 2 + 10, H / 2 + 6, 190, "#fff", "#fff");
  } else {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.38);
    ctx.fillStyle = "#fbfaf5";
    ctx.beginPath();
    ctx.ellipse(0, 0, 150, 270, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    glyph(ctx, card.v, W / 2, H / 2 + 4, card.v.length > 1 ? 210 : 330, color, "#fbfaf5");
  }

  // Petits symboles dans les coins (le second à l'envers, comme sur une vraie carte).
  const small = corner(card.v);
  if (small) {
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${small.length > 1 ? 66 : 84}px "Arial Black", Arial, sans-serif`;
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.strokeText(small, 92, 98);
    ctx.fillText(small, 92, 98);
    ctx.save();
    ctx.translate(W - 92, H - 98);
    ctx.rotate(Math.PI);
    ctx.strokeText(small, 0, 0);
    ctx.fillText(small, 0, 0);
    ctx.restore();
  }
  return canvas;
}

function drawBack() {
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fbfaf5";
  roundRect(ctx, 0, 0, W, H, 44);
  ctx.fill();
  ctx.fillStyle = "#15151d";
  roundRect(ctx, 26, 26, W - 52, H - 52, 30);
  ctx.fill();
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.38);
  ctx.fillStyle = "#d7263d";
  ctx.beginPath();
  ctx.ellipse(0, 0, 160, 285, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2b705";
  ctx.font = 'italic 900 150px "Arial Black", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#15151d";
  ctx.rotate(0.38);
  ctx.strokeText("UNO", 0, 0);
  ctx.fillText("UNO", 0, 0);
  ctx.restore();
  return canvas;
}

export function faceTexture(card) {
  const key = faceKey(card);
  if (!textures.has(key)) textures.set(key, toTexture(drawFace(card)));
  return textures.get(key);
}

export function backTexture() {
  if (!textures.has("back")) textures.set("back", toTexture(drawBack()));
  return textures.get("back");
}

// La face « dos » se retrouve à l'envers (rotation de 180°) quand la carte est retournée : on la tourne pour que « UNO » se lise à l'endroit.
function flippedBack() {
  if (!textures.has("backFlip")) {
    const t = backTexture().clone();
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI;
    t.needsUpdate = true;
    textures.set("backFlip", t);
  }
  return textures.get("backFlip");
}

const edge = new MeshStandardMaterial({ color: "#efe9db", roughness: 0.7 });

/** Matériaux d'un box [+x, -x, +y(face), -y(dos), +z, -z], partagés entre toutes les cartes identiques. */
export function cardMaterials(card) {
  const key = card ? faceKey(card) : "back";
  if (!materials.has(key)) {
    const front = new MeshStandardMaterial({ map: card ? faceTexture(card) : backTexture(), roughness: 0.5 });
    const back = new MeshStandardMaterial({ map: flippedBack(), roughness: 0.5 });
    materials.set(key, [edge, edge, front, back, edge, edge]);
  }
  return materials.get(key);
}

/** Texture de feutre légèrement grainée pour la table. */
export function feltTexture() {
  if (textures.has("felt")) return textures.get("felt");
  const canvas = makeCanvas(512, 512);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0f5a3a";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(${i % 2 ? "255,255,255" : "0,0,0"},${0.02 + (i % 5) * 0.008})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const tex = toTexture(canvas);
  textures.set("felt", tex);
  return tex;
}
