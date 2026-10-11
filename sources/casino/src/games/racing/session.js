// Une tentative de course : compte à rebours, pas fixe de la physique, réapparition, arrivée.
import { DT, createRun, respawn, step } from "./physics.js";

export const COUNTDOWN = 2.4; // secondes avant le top départ

export class RaceSession {
  constructor(track, world, { onFinish, onEvent } = {}) {
    this.track = track;
    this.world = world;
    this.onFinish = onFinish;
    this.restart();
    this.onEvent = onEvent;
  }

  restart() {
    this.run = createRun(this.track);
    this.phase = "countdown";
    this.count = COUNTDOWN;
    this.acc = 0;
    this.attempt = (this.attempt || 0) + 1;
    this.onEvent?.("restart");
  }

  respawnCp() {
    if (this.phase !== "race") return;
    respawn(this.run);
    this.onEvent?.("respawn");
  }

  get timeMs() {
    return this.run.finished ? this.run.finishMs : this.run.steps * 10;
  }

  update(dt, input) {
    dt = Math.min(dt, 0.1);
    if (this.phase === "countdown") {
      const before = Math.ceil(this.count);
      this.count -= dt;
      if (Math.ceil(this.count) !== before && this.count > 0) this.onEvent?.("tick");
      if (this.count <= 0) {
        this.phase = "race";
        this.onEvent?.("go");
      }
      return;
    }
    if (this.phase !== "race") {
      // après l'arrivée la voiture roue libre
      this.acc += dt;
      while (this.acc >= DT) {
        this.acc -= DT;
        const steps = this.run.steps;
        step(this.run, this.track, this.world, { throttle: 0, brake: 0.4, steer: 0, drift: false });
        this.run.steps = steps;
      }
      return;
    }
    this.acc += dt;
    while (this.acc >= DT && this.phase === "race") {
      this.acc -= DT;
      step(this.run, this.track, this.world, input);
      for (const e of this.run.events) {
        this.onEvent?.(e);
        if (e === "finish") {
          this.phase = "done";
          this.onFinish?.(this.run.finishMs, this.run.ghost.slice(), this.run.splits.slice());
        }
      }
    }
  }
}
