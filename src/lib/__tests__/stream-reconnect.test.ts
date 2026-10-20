import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AutoReconnectBudget, isNetworkFailure, isOnline, waitForOnline, type OnlineState } from '../stream-reconnect.ts';

function fakeNetwork(initial: OnlineState) {
  let listener: ((state: OnlineState) => void) | null = null;
  return {
    read: async () => initial,
    subscribe: (next: (state: OnlineState) => void) => { listener = next; return () => { listener = null; }; },
    emit: (state: OnlineState) => listener?.(state),
    get listening() { return listener !== null; },
  };
}

const tick = (ms: number) => new Promise((done) => setTimeout(done, ms));

test('a few drops in a row reconnect, then the error screen takes over', () => {
  const budget = new AutoReconnectBudget(3, 60_000);
  assert.equal(budget.take(0), true);
  assert.equal(budget.take(10_000), true);
  assert.equal(budget.take(20_000), true);
  assert.equal(budget.take(30_000), false);
});

test('drops spread over a long session keep reconnecting', () => {
  const budget = new AutoReconnectBudget(3, 60_000);
  for (let minute = 0; minute < 10; minute += 1) {
    assert.equal(budget.take(minute * 60_000), true);
  }
});

test('a refused drop does not use up the next window', () => {
  const budget = new AutoReconnectBudget(1, 60_000);
  assert.equal(budget.take(0), true);
  assert.equal(budget.take(59_000), false);
  assert.equal(budget.take(60_000), true);
});

test('reachability unknown still counts as online, a validated failure does not', () => {
  assert.equal(isOnline({ isConnected: true }), true);
  assert.equal(isOnline({ isConnected: true, isInternetReachable: false }), false);
  assert.equal(isOnline({ isConnected: false }), false);
});

test('reconnect waits for Wi-Fi to come back instead of failing on DNS', async () => {
  const network = fakeNetwork({ isConnected: false });
  const wait = waitForOnline(network.read, network.subscribe, 10_000, 0);
  await tick(5);
  network.emit({ isConnected: true, isInternetReachable: false });
  network.emit({ isConnected: true, isInternetReachable: true });
  assert.equal(await wait.promise, true);
  assert.equal(network.listening, false);
});

test('the stale "still connected" read right after Wi-Fi drops is ignored', async () => {
  const network = fakeNetwork({ isConnected: true, isInternetReachable: true });
  let resolved = false;
  const wait = waitForOnline(network.read, network.subscribe, 10_000, 30);
  void wait.promise.then(() => { resolved = true; });
  await tick(10);
  assert.equal(resolved, false);
  assert.equal(network.listening, false);
  assert.equal(await wait.promise, true);
});

test('timeout and cancel resolve false and stop listening', async () => {
  const offline = fakeNetwork({ isConnected: false });
  assert.equal(await waitForOnline(offline.read, offline.subscribe, 5, 0).promise, false);
  assert.equal(offline.listening, false);
  const cancelled = fakeNetwork({ isConnected: false });
  const wait = waitForOnline(cancelled.read, cancelled.subscribe, 10_000, 0);
  await tick(5);
  wait.cancel();
  assert.equal(await wait.promise, false);
  assert.equal(cancelled.listening, false);
});

test('DNS and fetch failures count as network drops, host refusals do not', () => {
  assert.equal(isNetworkFailure('fetch failed: java.net.UnknownHostException: Unable to resolve host "vn.protexa.cloud"'), true);
  assert.equal(isNetworkFailure('Network request failed'), true);
  assert.equal(isNetworkFailure('Kết nối WebRTC quá thời gian chờ.'), true);
  assert.equal(isNetworkFailure('Thiết bị đang có người sử dụng.'), false);
  assert.equal(isNetworkFailure('Sunshine đã kết thúc phiên (-1).'), false);
});
