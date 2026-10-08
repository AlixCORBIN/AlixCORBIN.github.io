export const ok = (extra) => ({
  ok: true,
  ...extra,
});

export const fail = (error) => ({
  ok: false,
  error,
});
