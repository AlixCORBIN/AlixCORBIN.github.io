import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// IA des bots du Monopoly : choisit l'échange à proposer et écrit les répliques.
// La clé reste secrète (secret Supabase GEMINI_API_KEY). Modèle réglable via GEMINI_MODEL.
const ALLOWED = ["https://alixcorbin.github.io", "http://localhost:5173", "http://localhost:4173"];
const last = new Map<string, number>();
let workingModel = "";

function cors(origin: string | null) {
  const o = origin && ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const SYS = `Tu joues un bot dans une partie de Monopoly (édition Paris) entre amis.
Tu réponds TOUJOURS en JSON valide, en français familier mais poli, phrases courtes (max 200 caractères), sans emoji excessif.
Tu restes dans ton personnage (personnalité donnée). Tu ne mens pas sur le contenu des échanges.`;

Deno.serve(async (req: Request) => {
  const h = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST attendu" }), { status: 405, headers: h });

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "GEMINI_API_KEY manquante" }), { status: 503, headers: h });

  // limite simple : 1 appel / 1,5 s par IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "?";
  const now = Date.now();
  if (now - (last.get(ip) || 0) < 1500) return new Response(JSON.stringify({ error: "trop de requetes" }), { status: 429, headers: h });
  last.set(ip, now);
  if (last.size > 5000) last.clear();

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "json" }), { status: 400, headers: h }); }
  const { mode, bot, context, candidates, trade, verdict, from, message } = body || {};
  const clip = (x: unknown, n = 1500) => String(x ?? "").slice(0, n);

  let task = "";
  if (mode === "pick" && Array.isArray(candidates) && candidates.length) {
    task = `Situation : ${clip(context)}
Tu es ${clip(bot?.name, 40)} (${clip(bot?.persona, 20)}). Voici des propositions d'échange possibles, déjà jugées avantageuses pour toi :
${candidates.slice(0, 4).map((c: any, i: number) => `${i}. ${clip(c, 300)}`).join("\n")}
Choisis celle qui a le plus de chances d'être acceptée tout en t'avantageant, et écris le message que tu envoies au joueur pour le convaincre.
Réponds : {"index": <numéro>, "message": "<ton message>"}`;
  } else if (mode === "reply") {
    task = `Situation : ${clip(context)}
Tu es ${clip(bot?.name, 40)} (${clip(bot?.persona, 20)}). On te propose : ${clip(trade, 400)}.
Ta décision (déjà prise, ne la change pas) : ${verdict === "accept" ? "ACCEPTER" : "REFUSER"}.
Écris ta réponse au joueur (si tu refuses, dis ce qui te ferait accepter).
Réponds : {"message": "<ta réponse>"}`;
  } else if (mode === "chat") {
    task = `Situation : ${clip(context)}
Tu es ${clip(bot?.name, 40)} (${clip(bot?.persona, 20)}). ${clip(from, 40)} t'écrit dans le chat de la partie : « ${clip(message, 300)} ».
Réponds-lui directement, en restant dans ton personnage, en tenant compte de la partie (argent, propriétés). Tu peux taquiner, négocier ou bluffer, mais ne promets aucun échange précis.
Commence ton message par @${clip(from, 40)}. Pour citer une case, écris #Nom exact de la case.
Réponds : {"message": "<ta réponse>"}`;
  } else return new Response(JSON.stringify({ error: "mode" }), { status: 400, headers: h });

  // modèles essayés dans l'ordre (les noms changent avec le temps) ; le premier qui marche est retenu
  const models = [Deno.env.get("GEMINI_MODEL"), workingModel, "gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean) as string[];
  let r: Response | null = null;
  for (const model of [...new Set(models)]) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS }] },
        contents: [{ role: "user", parts: [{ text: task }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 200, temperature: 0.9 },
      }),
    });
    if (r.status === 404) continue;
    if (r.ok) workingModel = model;
    break;
  }
  if (!r || !r.ok) return new Response(JSON.stringify({ error: "gemini " + (r?.status ?? "?") }), { status: 502, headers: h });
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let out: any = {};
  try { out = JSON.parse(text); } catch { out = { message: text }; }
  const res: any = { message: clip(out.message, 240), model: workingModel };
  if (mode === "pick") res.index = Number.isInteger(out.index) ? out.index : 0;
  return new Response(JSON.stringify(res), { headers: h });
});
