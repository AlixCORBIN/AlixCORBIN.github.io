// Compteur d'observateurs d'une salle : présence Supabase Realtime sur un canal « watch-CODE ».
// Les observateurs s'y déclarent ; joueurs et observateurs comptent les présents.
import React from "react";
import { supabase } from "./supabase.js";

export function useWatchers(ctrl) {
  const [count, setCount] = React.useState(0);
  const code = ctrl.online && ctrl.status === "ready" ? ctrl.code : null;
  const spectator = !!ctrl.spectator;
  React.useEffect(() => {
    if (!code) return undefined;
    const topic = "watch-" + code;
    let ch = null;
    try {
      // un canal laissé par une visite précédente de la même salle ferait planter .on() après subscribe()
      supabase.getChannels().filter((c) => c.topic === "realtime:" + topic).forEach((c) => supabase.removeChannel(c));
      ch = supabase.channel(topic, { config: { presence: { key: Math.random().toString(36).slice(2) } } });
      ch.on("presence", { event: "sync" }, () => {
        setCount(Object.values(ch.presenceState()).flat().filter((p) => p && p.w).length);
      });
      ch.subscribe((s) => {
        if (s === "SUBSCRIBED" && spectator) ch.track({ w: 1 }).catch(() => {});
      });
    } catch {
      return undefined;
    }
    return () => {
      try { supabase.removeChannel(ch); } catch {}
    };
  }, [code, spectator]);
  return count;
}
