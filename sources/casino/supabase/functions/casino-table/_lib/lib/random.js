// Version serveur de lib/random.js (CSPRNG uniquement ; random.org est fourni par la fonction)
export function secureRandomInt(max) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(4294967296 / max) * max;
  let v;
  do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
  return v % max;
}
