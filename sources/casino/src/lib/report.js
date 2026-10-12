// Résultats des jeux de société (UNO, Loup-Garou, Buckshot…) :
// l'hôte prépare le résultat et le diffuse dans l'état de la salle ; CHAQUE joueur humain
// le confirme lui-même auprès du serveur (RPC report_game). La partie n'est enregistrée que
// quand tous les humains listés ont envoyé exactement le même résultat, et les classements
// ne comptent que les parties entre au moins deux humains. Fabriquer une partie seul ne sert plus à rien.
import React from "react";
import { myUid, rpc } from "./identity.js";

let activeHost = null;
export const setActiveHost = (h) => {
  activeHost = h;
};

// Appelé par les api.js des jeux à la place de l'ancien RPC save_*_game (une fois, par l'hôte)
export async function reportResult(game, args) {
  activeHost?.setReport?.(game, structuredClone(args));
  return { error: null };
}

export function buildReport(game, args, uidOf) {
  const uids = [];
  if (Array.isArray(args.p_players)) {
    args.p_players = args.p_players.map((p) => {
      const { id, ...rest } = p;
      if (rest.bot) return rest;
      const uid = uidOf(id);
      if (uid) uids.push(uid);
      return { ...rest, uid: uid || "00000000-0000-0000-0000-000000000000" };
    });
  }
  return { id: args.p_id, game, payload: { uids: [...new Set(uids)], args } };
}

export function useReportResult(ctrl, state) {
  const sent = React.useRef(null);
  const report = state?.report;
  React.useEffect(() => {
    if (!report?.id || sent.current === report.id) return;
    sent.current = report.id;
    myUid().then((uid) => {
      if (!uid || !report.payload?.uids?.includes(uid)) return;
      rpc("report_game", { p_game: report.game, p_payload: report.payload }).catch((e) => console.warn("report_game", e.message));
    });
  }, [report?.id]);
}
