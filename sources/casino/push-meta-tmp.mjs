import { OFFICIAL } from "./src/games/racing/maps.js";
import { trackMeta } from "./src/games/racing/meta.js";
const rows = OFFICIAL.map((m) => ({ id: m.id, meta: trackMeta(m.data) }));
const r = await fetch("https://njkbhgmwylletmdmsmyl.supabase.co/rest/v1/rpc/tmp_racing_set_meta", {
  method: "POST",
  headers: { apikey: "sb_publishable_VYQeM9TBjjoqs4CeAT06mQ_1AJ4uf7p", "Content-Type": "application/json" },
  body: JSON.stringify({ p_key: "k7Qe2rVx91Lm", p_rows: rows }),
});
console.log(r.status, await r.text());
