import { SUPABASE_ANON_JWT, SUPABASE_URL } from "./supabase.js";

export function secureRandomInt(max) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || !cryptoApi.getRandomValues)
    return Math.floor(Math.random() * max);
  const buf = new Uint32Array(1);
  const limit = Math.floor(4294967296 / max) * max;
  let value;
  do {
    cryptoApi.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % max;
}

const MAX_KEY = 999999999;

const isIntArray = (arr, len, min, max) =>
  Array.isArray(arr) &&
  arr.length === len &&
  arr.every((v) => Number.isInteger(v) && v >= min && v <= max);

async function fetchViaEdgeFunction(count, min, max, fetchImpl, signal) {
  const res = await fetchImpl(
    `${SUPABASE_URL}/functions/v1/random-shoe?n=${count}&min=${min}&max=${max}`,
    {
      signal,
      headers: {
        apikey: SUPABASE_ANON_JWT,
        Authorization: `Bearer ${SUPABASE_ANON_JWT}`,
      },
    },
  );
  if (!res.ok) throw new Error("fonction random-shoe HTTP " + res.status);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  const values = body.random && body.random.data;
  if (!isIntArray(values, count, min, max)) throw new Error("reponse invalide");
  return {
    values,
    meta: {
      source: "random.org",
      at: Date.now(),
      proof: {
        random: body.random,
        signature: body.signature,
      },
    },
  };
}

async function fetchFromRandomOrg(count, min, max, fetchImpl, signal) {
  const url = `https://www.random.org/integers/?num=${count}&min=${min}&max=${max}&col=1&base=10&format=plain&rnd=new`;
  const res = await fetchImpl(url, {
    signal,
  });
  if (!res.ok) throw new Error("random.org HTTP " + res.status);
  const values = (await res.text()).trim().split(/\s+/).map(Number);
  if (!isIntArray(values, count, min, max)) throw new Error("reponse invalide");
  return {
    values,
    meta: {
      source: "random.org",
      at: Date.now(),
      proof: null,
    },
  };
}

export async function fetchRandomIntegers(
  count,
  {
    min = 0,
    max = MAX_KEY,
    timeoutMs = 6000,
    fetchImpl = globalThis.fetch,
    useProxy = true,
  } = {},
) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (useProxy)
      try {
        return await fetchViaEdgeFunction(
          count,
          min,
          max,
          fetchImpl,
          ctrl.signal,
        );
      } catch (err) {
        if (ctrl.signal.aborted) throw err;
      }
    return await fetchFromRandomOrg(count, min, max, fetchImpl, ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchShuffleKeys(count, opts = {}) {
  const { values, meta } = await fetchRandomIntegers(count, {
    ...opts,
    min: 0,
    max: MAX_KEY,
  });
  return {
    keys: values,
    meta,
  };
}
