import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withRequestTimeout } from '../request-timeout.ts';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('a stalled request rejects at the deadline and aborts its transport', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requestSignal: AbortSignal | undefined;
  const request = withRequestTimeout((signal) => {
    requestSignal = signal;
    return new Promise<never>(() => {});
  }, undefined, 100);
  const rejected = assert.rejects(request, /Kết nối quá lâu/);
  await flush();
  t.mock.timers.tick(100);
  await rejected;
  assert.equal(requestSignal?.aborted, true);
});

test('the deadline still applies after headers while reading the body', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let readingBody = false;
  const request = withRequestTimeout(async () => {
    const response = await Promise.resolve({ json: () => new Promise<never>(() => {}) });
    readingBody = true;
    return response.json();
  }, undefined, 100);
  const rejected = assert.rejects(request, /Kết nối quá lâu/);
  await flush();
  assert.equal(readingBody, true);
  t.mock.timers.tick(100);
  await rejected;
});

test('caller cancellation settles even if the operation ignores its signal', async () => {
  const caller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  const request = withRequestTimeout((signal) => {
    requestSignal = signal;
    return new Promise<never>(() => {});
  }, caller.signal);
  const reason = new Error('screen closed');
  const rejected = assert.rejects(request, (error) => error === reason);
  await flush();
  caller.abort(reason);
  await rejected;
  assert.equal(requestSignal?.aborted, true);
});

test('an already cancelled request never starts work', async () => {
  const caller = new AbortController();
  caller.abort(new Error('cancelled'));
  let started = false;
  await assert.rejects(withRequestTimeout(async () => { started = true; }, caller.signal), /cancelled/);
  assert.equal(started, false);
});

test('success removes deadline and caller listeners', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const caller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  assert.equal(await withRequestTimeout(async (signal) => {
    requestSignal = signal;
    return 42;
  }, caller.signal, 100), 42);
  t.mock.timers.tick(200);
  caller.abort();
  assert.equal(requestSignal?.aborted, false);
});

test('operation errors are preserved', async () => {
  const failure = new Error('server failed');
  await assert.rejects(withRequestTimeout(async () => { throw failure; }), (error) => error === failure);
});
