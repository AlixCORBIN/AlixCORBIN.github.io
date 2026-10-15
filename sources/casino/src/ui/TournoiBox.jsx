import React from "react";
import { account } from "../lib/mii.js";
import { db, myUid, rpc, session } from "../lib/identity.js";
import { useAdmins } from "../lib/admins.js";

const TZ = "Europe/Paris";

// « lundi 19 octobre 00:01 », toujours à l'heure de Paris
function fmt(iso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.weekday} ${p.day} ${p.month} ${p.hour}:${p.minute}`;
}

function remaining(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d ? `${d} j ${h} h ${m % 60} min` : h ? `${h} h ${m % 60} min` : `${m} min`;
}

function useTournament() {
  const [t, setT] = React.useState(undefined); // undefined = chargement, null = aucun tournoi en base
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    let off = false;
    Promise.resolve(db().from("tournaments").select("starts_at, ends_at").eq("id", "t1").maybeSingle())
      .then(({ data }) => !off && setT(data || null), () => !off && setT(null));
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => { off = true; clearInterval(id); };
  }, []);
  return { t, now };
}

export function TournoiBox() {
  const { t, now } = useTournament();
  const admins = useAdmins();
  const [uid, setUid] = React.useState(null);
  const [link, setLink] = React.useState(undefined); // undefined = chargement, null = pas relié
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      await session();
      setUid(await myUid());
      const { data: ids } = await account.sb.auth.getUserIdentities();
      if (!ids?.identities?.some((i) => i.provider === "discord")) return setLink(null);
      // le serveur relit l'identité Discord dans auth.identities et la recopie
      await rpc("tournament_link_discord");
      const { data } = await db().from("tournament_discord").select("discord_name, discord_avatar").maybeSingle();
      setLink(data || null);
    } catch (e) {
      setLink(null);
      setMsg(e.message);
    }
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);

  const linkDiscord = async () => {
    setMsg("");
    setBusy(true);
    try {
      await session();
      await account.linkDiscord();
    } catch (e) {
      setBusy(false);
      setMsg(/manual linking/i.test(e.message) ? "La liaison de comptes n'est pas activée côté serveur." : e.message);
    }
  };

  const saveNow = async () => {
    setMsg("");
    setBusy(true);
    try {
      const r = await rpc("tournament_save_now");
      setMsg(`Sauvegarde faite : ${r.racing} temps, ${r.casino} soldes.`);
    } catch (e) {
      setMsg(e.message);
    }
    setBusy(false);
  };

  const start = t && new Date(t.starts_at).getTime();
  const end = t && new Date(t.ends_at).getTime();
  const status = !t ? "" : now < start ? `Ouverture dans ${remaining(start - now)}` : now < end ? `Fin dans ${remaining(end - now)}` : "Tournoi terminé, résultats annoncés prochainement";

  return (
    <div className="c-box tournoi">
      <h2>🏆 Tournoi</h2>
      {t && (
        <>
          <p className="t-dates">{`Du ${fmt(t.starts_at)} au ${fmt(t.ends_at)}`}</p>
          <p className="t-count">{status}</p>
        </>
      )}
      {link === undefined ? (
        <p className="t-note">Chargement…</p>
      ) : link ? (
        <p className="t-linked">
          {link.discord_avatar && <img src={link.discord_avatar} alt="" width="24" height="24" />}
          <span>Discord relié : <b>{link.discord_name || "compte Discord"}</b></span>
        </p>
      ) : (
        <>
          <p className="t-note">Relie ton compte Discord pour être classé. Un compte Discord par personne.</p>
          <button className="btn primary" disabled={busy} onClick={linkDiscord}>Relier mon Discord</button>
        </>
      )}
      {uid && admins.isAdminUid(uid) && (
        <button className="btn" disabled={busy} onClick={saveNow}>Sauvegarder maintenant</button>
      )}
      {msg && <p className="t-msg">{msg}</p>}
    </div>
  );
}
