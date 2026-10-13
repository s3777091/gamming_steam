import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const SAMPLE_RATE = 48_000;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'assets', 'sounds');
mkdirSync(output, { recursive: true });

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

// Original, deliberately restrained one-shot cues with a shared glassy palette.
writeWav('ui-focus.wav', 0.052, (t, d) => {
  const body = sine(1120, t) * 0.14 + sine(2240, t, 0.35) * 0.035;
  return body * fade(t, d, 0.002, 0.038) * Math.exp(-t * 30);
});

writeWav('ui-navigate.wav', 0.078, (t, d) => {
  const p = t / d;
  const chirp = sine(650 + 340 * p, t) * 0.12 + sine(1300 + 220 * p, t, 0.55) * 0.025;
  return chirp * fade(t, d, 0.002, 0.052) * Math.exp(-t * 13);
});

writeWav('ui-select.wav', 0.064, (t, d) => {
  const click = sine(880, t) * 0.16 + sine(1760, t, 0.25) * 0.04;
  return click * fade(t, d, 0.0015, 0.046) * Math.exp(-t * 22);
});

writeWav('ui-confirm.wav', 0.112, (t, d) => {
  const bell = sine(920, t) * 0.14 + sine(1380, t, 0.25) * 0.045;
  return bell * fade(t, d, 0.002, 0.078) * Math.exp(-t * 15);
});

writeWav('ui-back.wav', 0.096, (t, d) => {
  const p = t / d;
  const descending = sine(520 - 150 * p, t) * 0.13 + sine(780 - 190 * p, t, 0.5) * 0.025;
  return descending * fade(t, d, 0.003, 0.064) * Math.exp(-t * 11);
});

writeWav('ui-transition.wav', 0.128, (t, d) => {
  const p = t / d;
  const tone = sine(430 + 180 * p, t) * 0.065 + sine(860 + 260 * p, t, 0.8) * 0.018;
  return tone * fade(t, d, 0.008, 0.082) * (0.78 + p * 0.22);
});

console.log(`Generated UI sounds in ${output}`);
