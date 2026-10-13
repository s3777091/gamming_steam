import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const SAMPLE_RATE = 48_000;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'assets', 'sounds');
mkdirSync(output, { recursive: true });

let seed = 0x51f15e;
const noise = () => {
  seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
  return (seed / 0xffff_ffff) * 2 - 1;
};

const clamp = (value) => Math.max(-1, Math.min(1, value));
const smooth = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};
const fade = (t, duration, attack = 0.006, release = 0.035) => (
  smooth(0, attack, t) * (1 - smooth(duration - release, duration, t))
);
const sine = (frequency, t, phase = 0) => Math.sin(Math.PI * 2 * frequency * t + phase);

function writeWav(name, duration, render) {
  const samples = Math.round(SAMPLE_RATE * duration);
  const dataBytes = samples * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples; index += 1) {
    const t = index / SAMPLE_RATE;
    wav.writeInt16LE(Math.round(clamp(render(t, duration)) * 32_767), 44 + index * 2);
  }
  writeFileSync(resolve(output, name), wav);
}

// Original, deliberately restrained cues: glassy partials and filtered air share one sonic palette.
writeWav('ui-focus.wav', 0.068, (t, d) => {
  const body = sine(1180, t) * 0.16 + sine(2360, t, 0.35) * 0.055;
  return body * fade(t, d, 0.002, 0.052) * Math.exp(-t * 24);
});

writeWav('ui-navigate.wav', 0.112, (t, d) => {
  const p = t / d;
  const chirp = sine(620 + 520 * p, t) * 0.13 + sine(1320 + 420 * p, t, 0.6) * 0.035;
  const air = (noise() - noise() * 0.55) * 0.025 * smooth(0, 0.025, t);
  return (chirp + air) * fade(t, d, 0.003, 0.07) * Math.exp(-t * 8);
});

writeWav('ui-select.wav', 0.086, (t, d) => {
  const click = sine(940, t) * 0.18 + sine(1880, t, 0.25) * 0.06;
  return click * fade(t, d, 0.0015, 0.064) * Math.exp(-t * 17);
});

writeWav('ui-confirm.wav', 0.232, (t, d) => {
  const first = sine(740, t) * Math.exp(-t * 18) * 0.12;
  const delay = Math.max(0, t - 0.062);
  const secondEnvelope = t < 0.062 ? 0 : Math.exp(-delay * 13) * smooth(0, 0.008, delay);
  const second = (sine(1110, delay) * 0.13 + sine(1665, delay, 0.2) * 0.045) * secondEnvelope;
  return (first + second) * fade(t, d, 0.003, 0.075);
});

writeWav('ui-back.wav', 0.158, (t, d) => {
  const p = t / d;
  const descending = sine(520 - 190 * p, t) * 0.14 + sine(780 - 250 * p, t, 0.5) * 0.035;
  return descending * fade(t, d, 0.004, 0.085) * Math.exp(-t * 7);
});

writeWav('ui-transition.wav', 0.224, (t, d) => {
  const p = t / d;
  const tone = (sine(390 + 250 * p, t) * 0.055 + sine(980 + 560 * p, t, 0.8) * 0.025);
  const air = (noise() - noise() * 0.72) * 0.035 * smooth(0, 0.055, t);
  return (tone + air) * fade(t, d, 0.012, 0.11) * (0.72 + p * 0.28);
});

console.log(`Generated UI sounds in ${output}`);
