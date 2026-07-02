// Subtle ambience built with Tone.js: a very quiet low drone, sparse
// distant echoes, and small interaction cues. Created lazily after the
// first user gesture (required for WebAudio).

import * as Tone from 'tone';

let ctx = null;

// Settings survive across init and are applied the moment audio exists.
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

  // A faint airy shimmer so the silence never feels dead.
  const airGain = new Tone.Gain(0.006).connect(reverb);
  const airFilter = new Tone.Filter(1900, 'bandpass').connect(airGain);
  const air = new Tone.Noise('pink').connect(airFilter).start();
  const airLfo = new Tone.LFO(0.045, 1200, 2600).start();
  airLfo.connect(airFilter.frequency);

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

  // Page rustle: filtered noise burst.
  const pageNoise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.03, decay: 0.22, sustain: 0 },
    volume: -22,
  }).connect(master);

  // Footsteps: a dull noise thud through a wandering lowpass.
  const stepFilter = new Tone.Filter(380, 'lowpass').connect(master);
  const stepNoise = new Tone.NoiseSynth({
    noise: { type: 'brown' },
    envelope: { attack: 0.002, decay: 0.09, sustain: 0 },
    volume: -24,
  }).connect(stepFilter);
  const stepThump = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
    volume: -30,
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

  return {
    master,
    pageOpen() {
      pageNoise.triggerAttackRelease(0.2);
    },
    pageClose() {
      pageNoise.triggerAttackRelease(0.12);
    },
    footstep() {
      stepFilter.frequency.value = 300 + Math.random() * 220;
      stepNoise.triggerAttackRelease(0.07);
      stepThump.triggerAttackRelease(36 + Math.random() * 8, 0.06);
    },
    uiClick() {
      uiSynth.triggerAttackRelease('C5', 0.06);
    },
    pathAdvance() {
      echoSynth.triggerAttackRelease('A3', 1.2);
    },
    pathLost() {
      echoSynth.triggerAttackRelease('Eb2', 2);
    },
    roomStep() {
      roomSynth.triggerAttackRelease('C1', 0.1);
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
        air, airFilter, airGain, airLfo,
        echoSynth, pageNoise, stepNoise, stepFilter, stepThump,
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
