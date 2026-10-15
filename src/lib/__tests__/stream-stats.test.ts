import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readStreamStats, StreamStatsStore, streamQuality, type StatsRow } from '../stream-stats.ts';

function rows(at: number, received = 1000, lost = 100, bytes = 1_000_000): StatsRow[] {
  return [
    { id: 'video', type: 'inbound-rtp', kind: 'video', transportId: 'transport', timestamp: at,
      packetsReceived: received, packetsLost: lost, bytesReceived: bytes, jitter: 0.004,
      framesPerSecond: 60, framesDropped: 2, frameWidth: 1920, frameHeight: 1080 },
    { id: 'transport', type: 'transport', selectedCandidatePairId: 'selected' },
    { id: 'selected', type: 'candidate-pair', state: 'succeeded', nominated: true,
      currentRoundTripTime: 0.012, localCandidateId: 'local', remoteCandidateId: 'remote' },
    { id: 'local', type: 'local-candidate', candidateType: 'host' },
    { id: 'remote', type: 'remote-candidate', candidateType: 'host' },
  ];
}

test('network quality uses measured interval loss, not lifetime loss or invented defaults', () => {
  const first = readStreamStats(rows(1000), null, 123);
  assert.equal(first.stats.sampledAt, 123);
  assert.equal(first.stats.rttMs, 12);
  assert.equal(first.stats.jitterMs, 4);
  assert.equal(first.stats.lossPercent, null);
  assert.equal(streamQuality(first.stats), null);
  const next = readStreamStats(rows(2000, 2000, 100, 3_000_000), first.sample);
  assert.equal(next.stats.lossPercent, 0);
  assert.equal(next.stats.bitrateMbps, 16);
  assert.equal(next.stats.fps, 60);
  assert.equal(streamQuality(next.stats), 'good');
  const degraded = readStreamStats(rows(3000, 2960, 140, 4_000_000), next.sample);
  assert.equal(degraded.stats.lossPercent, 4);
  assert.equal(streamQuality(degraded.stats), 'poor');
});

test('the selected transport wins over other nominated pairs, including a remote relay', () => {
  const report = rows(1000);
  report.push({ id: 'unused', type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.9 });
  report.find((row) => row.id === 'remote')!.candidateType = 'relay';
  const { stats } = readStreamStats(report, null);
  assert.equal(stats.rttMs, 12);
  assert.equal(stats.route, 'Relay');
});

test('ambiguous routes and absent packet counters remain unknown', () => {
  const report = rows(1000).filter((row) => row.id !== 'transport');
  report.push({ id: 'other', type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.1 });
  const { stats } = readStreamStats(report, null);
  assert.equal(stats.rttMs, null);
  assert.equal(stats.route, null);
  assert.equal(streamQuality(readStreamStats([], null).stats), null);
});

test('reconnections, counter resets and idle intervals never produce negative rates or false healthy samples', () => {
  const first = readStreamStats(rows(1000), null);
  const reset = readStreamStats(rows(2000, 1, 0, 10), first.sample);
  assert.equal(reset.stats.bitrateMbps, null);
  assert.equal(reset.stats.lossPercent, null);
  const idle = readStreamStats(rows(2000), first.sample);
  assert.equal(idle.stats.lossPercent, null);
  const switchedRows = rows(2000, 2000, 100, 3_000_000);
  switchedRows[0].id = 'new-video';
  const switched = readStreamStats(switchedRows, first.sample);
  assert.equal(switched.stats.bitrateMbps, null);
  assert.equal(switched.stats.lossPercent, null);
});

test('quality considers RTT and jitter but waits for actual loss measurements', () => {
  const { stats } = readStreamStats(rows(1000), null);
  assert.equal(streamQuality({ ...stats, rttMs: 200 }), null);
  assert.equal(streamQuality({ ...stats, lossPercent: 0, rttMs: 60 }), 'fair');
  assert.equal(streamQuality({ ...stats, lossPercent: 0, jitterMs: 40 }), 'poor');
});

test('shared telemetry keeps stable snapshots and stops notifying removed subscribers', () => {
  const store = new StreamStatsStore();
  const initial = store.getSnapshot();
  assert.equal(initial, store.getSnapshot());
  let notifications = 0;
  const off = store.subscribe(() => { notifications += 1; });
  const { stats } = readStreamStats(rows(1000), null);
  store.publish(stats, true);
  store.publish(stats, true);
  assert.equal(notifications, 1);
  off();
  store.publish(stats, false);
  assert.equal(notifications, 1);
  assert.equal(store.getSnapshot().stats, stats);
  assert.equal(store.getSnapshot().live, false);
});
