// Une tentative de course : compte à rebours, pas fixe de la physique, réapparition, arrivée.
// Le monde Rapier est créé une fois par piste ; recommencer replace simplement la voiture.
import { DT, createCar, createRun, createWorld, driveCar, placeCar, stepRun } from "./physics.js";

export const COUNTDOWN = 2.4; // secondes avant le top départ
const IDLE = { throttle: 0, brake: 0, steer: 0, drift: false };

export class RaceSession {
  constructor(track, world, { onFinish, onEvent } = {}) {
    this.track = track;
    this.world = world;
    this.onFinish = onFinish;
    this.phys = createWorld(track);
    this.car = createCar(this.phys, track.spawn());
    this.restart();
    this.onEvent = onEvent;
  }

  restart() {
    this.run = createRun(this.track);
    placeCar(this.car, this.run.lastSpawn);
    this.phase = "countdown";
    this.count = COUNTDOWN;
    this.acc = 0;
    this.onEvent?.("restart");
  }

  respawnCp() {
    if (this.phase !== "race") return;
    placeCar(this.car, this.run.lastSpawn);
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
      // la voiture se pose sur ses roues pendant le décompte
      this.acc += dt;
      while (this.acc >= DT) { this.acc -= DT; driveCar(this.phys, this.car, this.world, IDLE); this.phys.world.step(); }
      if (this.count <= 0) {
        this.acc = 0;
        this.phase = "race";
        this.onEvent?.("go");
      }
      return;
    }
    this.acc += dt;
    while (this.acc >= DT) {
      this.acc -= DT;
      if (this.phase !== "race") {
        // après l'arrivée : roue libre, le chrono ne bouge plus
        const steps = this.run.steps;
        stepRun(this.run, this.track, this.phys, this.car, this.world, IDLE);
        this.run.steps = steps;
        continue;
      }
      stepRun(this.run, this.track, this.phys, this.car, this.world, input);
      for (const e of this.run.events) {
        this.onEvent?.(e);
        if (e === "finish") {
          this.phase = "done";
          this.onFinish?.(this.run.finishMs, this.run.ghost.slice(), this.run.splits.slice());
        }
      }
    }
  }

  dispose() {
    this.phys.world.free();
  }
}
