// Subtle ambience built with Tone.js: sine/triangle tones only — no noise
// generators. Created lazily after the first user gesture (WebAudio policy).

import * as Tone from 'tone';

let ctx = null;

const BASE_MASTER_GAIN = 0.8;
let currentVolume = 0.7;
let currentMuted = false;

function effectiveGain() {
  return currentMuted ? 0 : BASE_MASTER_GAIN * currentVolume;
}

async function build() {
  await Tone.start();

  const master = new Tone.Gain(effectiveGain()).toDestination();
  const reverb = new Tone.Reverb({ decay: 9, wet: 0.6, preDelay: 0.08 }).connect(master);

  // Low double drone under everything, kept soft.
  const droneGain = new Tone.Gain(0.045).connect(reverb);
  const filter = new Tone.Filter(180, 'lowpass').connect(droneGain);
  const oscA = new Tone.Oscillator(54, 'sine').connect(filter).start();
  const oscB = new Tone.Oscillator(54.35, 'sine').connect(filter).start();
  oscA.volume.value = -18;
  oscB.volume.value = -20;
  const lfo = new Tone.LFO(0.02, 120, 260).start();
  lfo.connect(filter.frequency);

  // Distant echoes: a soft struck tone through long reverb, every 10-32 s.
  const echoSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.4, decay: 2.4, sustain: 0, release: 3 },
    volume: -29,
  }).connect(reverb);
  const echoNotes = ['A2', 'C3', 'E3', 'D3', 'G2'];
  let echoTimer = null;
  function scheduleEcho() {
    echoTimer = setTimeout(() => {
      const note = echoNotes[Math.floor(Math.random() * echoNotes.length)];
      echoSynth.triggerAttackRelease(note, 2.5);
      scheduleEcho();
    }, 10000 + Math.random() * 22000);
  }
  scheduleEcho();

  // Page turn: soft plucked tone, no noise.
  const pageSynth = new Tone.PluckSynth({
    attackNoise: 0,
    dampening: 3200,
    resonance: 0.82,
    volume: -26,
  }).connect(reverb);

  // Footsteps: dull membrane thud only.
  const stepThump = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.11, sustain: 0 },
    volume: -28,
  }).connect(master);

  // Small dry pluck for menu/UI feedback.
  const uiSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.14, sustain: 0 },
    volume: -24,
  }).connect(reverb);

  const winSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 1.6, decay: 3, sustain: 0.25, release: 6 },
    volume: -20,
  }).connect(reverb);

  const roomSynth = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
    volume: -28,
  }).connect(master);

  const meowSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.025, decay: 0.1, sustain: 0.12, release: 0.32 },
    volume: -22,
  }).connect(reverb);

  return {
    master,
    pageOpen() {
      pageSynth.triggerAttackRelease('G4', 0.18);
    },
    pageClose() {
      pageSynth.triggerAttackRelease('D4', 0.12);
    },
    footstep() {
      stepThump.triggerAttackRelease(36 + Math.random() * 8, 0.07);
    },
    uiClick() {
      uiSynth.triggerAttackRelease('C5', 0.06);
    },
    pathAdvance() {
      echoSynth.triggerAttackRelease('A3', 1.2);
    },
    /** Soft, unsettled chord under a path revelation cutscene. */
    revelation() {
      const now = Tone.now();
      echoSynth.triggerAttackRelease('E3', 2.4, now);
      echoSynth.triggerAttackRelease('B2', 3.0, now + 0.55);
      echoSynth.triggerAttackRelease('F#3', 2.2, now + 1.3);
    },
    pathLost() {
      echoSynth.triggerAttackRelease('Eb2', 2);
    },
    /** Low swell when the final chamber seals and transforms. */
    crimsonReveal() {
      const now = Tone.now();
      echoSynth.triggerAttackRelease('D2', 2.4, now);
      echoSynth.triggerAttackRelease('A2', 3.2, now + 0.8);
      roomSynth.triggerAttackRelease('G1', 1.8, now + 0.3);
    },
    roomStep() {
      roomSynth.triggerAttackRelease('C1', 0.1);
    },
    /** Soft two-note meow — sine only, pitch varies by cat color. */
    meow(variant = 0) {
      const now = Tone.now();
      const base = 280 + variant * 35 + Math.random() * 70;
      meowSynth.triggerAttackRelease(base, 0.18, now);
      meowSynth.triggerAttackRelease(base * 1.4, 0.28, now + 0.16);
    },
    win() {
      const now = Tone.now();
      winSynth.triggerAttackRelease(['A2', 'E3', 'C4'], 8, now);
      winSynth.triggerAttackRelease(['B3', 'E4'], 6, now + 2.2);
    },
    dispose() {
      clearTimeout(echoTimer);
      const nodes = [
        oscA, oscB, lfo, filter, droneGain,
        echoSynth, pageSynth, stepThump, meowSynth,
        uiSynth, winSynth, roomSynth, reverb, master,
      ];
      for (const node of nodes) node.dispose();
    },
  };
}

/** Idempotent init; safe to call on every user gesture. */
export async function initAudio() {
  if (!ctx) ctx = await build();
  return ctx;
}

export function getAudio() {
  return ctx;
}

export function setVolume(v) {
  currentVolume = Math.max(0, Math.min(1, v));
  ctx?.master.gain.rampTo(effectiveGain(), 0.1);
}

export function setMuted(muted) {
  currentMuted = muted;
  ctx?.master.gain.rampTo(effectiveGain(), 0.05);
}

export function getAudioSettings() {
  return { volume: currentVolume, muted: currentMuted };
}
