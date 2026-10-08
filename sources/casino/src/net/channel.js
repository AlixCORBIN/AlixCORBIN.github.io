import { supabase } from "../lib/supabase.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const makeRoomCode = () =>
  Array.from(
    {
      length: 5,
    },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join("");

const makePeerId = () =>
  Array.from(
    {
      length: 10,
    },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join("");

export class RoomChannel {
  constructor(code, onMessage, isHost = false) {
    this.id = makePeerId();
    this.ch = supabase.channel("casino-" + code, {
      config: {
        broadcast: {
          self: false,
          ack: false,
        },
      },
    });
    this.ch.on(
      "broadcast",
      {
        event: "m",
      },
      ({ payload }) => {
        if (
          payload &&
          (payload.to === "*" ||
            payload.to === this.id ||
            (isHost && payload.to === "host"))
        ) {
          onMessage(payload.m, payload.from);
        }
      },
    );
    this.ready = new Promise((resolve, reject) => {
      this.ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error(status));
        }
      });
    });
    this.ready.catch(() => {});
  }
  send(to, msg) {
    this.ch.send({
      type: "broadcast",
      event: "m",
      payload: {
        to,
        from: this.id,
        m: msg,
      },
    });
  }
  close() {
    try {
      supabase.removeChannel(this.ch);
    } catch {}
  }
}
