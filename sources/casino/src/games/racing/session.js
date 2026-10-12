// Une tentative de course : compte à rebours, pas fixe de la physique, réapparition, arrivée.
// Chaque tentative repart d'un monde physique neuf et d'un décompte de durée fixe, et on
// enregistre les entrées appliquées à chaque pas : le serveur rejoue exactement la même
// course pour valider le temps (voir server/replay.js et l'Edge Function racing-verify).
import { DT, placeCar, stepRun } from "./physics.js";
import { COUNTDOWN_STEPS, IDLE, countdownStep, createLog, exportLog, logInput, quantize, startRace, toInput } from "../../server/replay.js";

export const COUNTDOWN = COUNTDOWN_STEPS / 100; // secondes avant le top départ

export class RaceSession {
  constructor(track, world, { onFinish, onEvent } = {}) {
    this.track = track;
    this.world = world;
    this.onFinish = onFinish;
    this.onEvent = onEvent;
    this.restart();
  }

  restart() {
    this.phys?.world.free();
    const s = startRace(this.track);
    this.phys = s.phys;
    this.run = s.run;
    this.car = s.car;
    this.log = createLog();
    this.phase = "countdown";
    this.cdSteps = 0;
    this.count = COUNTDOWN;
    this.acc = 0;
    this.onEvent?.("restart");
  }

  respawnCp() {
    if (this.phase !== "race") return;
    this.log.r.push(this.run.steps);
    placeCar(this.car, this.run.lastSpawn);
    this.onEvent?.("respawn");
  }

  get timeMs() {
    return this.run.finished ? this.run.finishMs : this.run.steps * 10;
  }

  update(dt, input) {
    dt = Math.min(dt, 0.1);
    this.acc += dt;
    while (this.acc >= DT) {
      this.acc -= DT;
      if (this.phase === "countdown") {
        // la voiture se pose sur ses roues pendant le décompte (nombre de pas fixe)
        const before = Math.ceil(this.count);
        countdownStep(this, this.world);
        this.cdSteps++;
        this.count = (COUNTDOWN_STEPS - this.cdSteps) / 100;
        if (Math.ceil(this.count) !== before && this.count > 0) this.onEvent?.("tick");
        if (this.cdSteps >= COUNTDOWN_STEPS) {
          this.acc = 0;
          this.phase = "race";
          this.onEvent?.("go");
          return;
        }
        continue;
      }
      if (this.phase !== "race") {
        // après l'arrivée : roue libre, le chrono ne bouge plus
        const steps = this.run.steps;
        stepRun(this.run, this.track, this.phys, this.car, this.world, IDLE);
        this.run.steps = steps;
        continue;
      }
      const q = quantize(input);
      logInput(this.log, this.run.steps, q);
      stepRun(this.run, this.track, this.phys, this.car, this.world, toInput(q));
      for (const e of this.run.events) {
        this.onEvent?.(e);
        if (e === "finish") {
          this.phase = "done";
          this.onFinish?.(this.run.finishMs, this.run.ghost.slice(), this.run.splits.slice(), exportLog(this.log));
        }
      }
    }
  }

  dispose() {
    this.phys.world.free();
  }
}
