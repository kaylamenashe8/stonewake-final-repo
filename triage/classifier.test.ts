import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, type ClassifierEvidence } from './classifier';
import type { FailedTestEx } from './report';
import { EMPTY_TRACE, type NetworkCall } from './trace';

const base: FailedTestEx = {
  test: 'tests/e2e/cart.spec.ts > should add item',
  file: 'tests/e2e/cart.spec.ts',
  line: 10,
  project: 'chromium',
  error: '',
  reportStatus: 'unexpected',
};
const ev = (network: NetworkCall[] = [], extra: Partial<ClassifierEvidence> = {}): ClassifierEvidence => ({
  trace: { ...EMPTY_TRACE, network },
  appOrigins: ['https://shop.test'],
  ...extra,
});
const call = (url: string, status: number, resourceType = 'xhr'): NetworkCall => ({
  method: 'GET',
  url,
  status,
  resourceType,
  time: 1,
});

void test('net::ERR is environment and final', () => {
  const r = classify({ ...base, error: 'page.goto: net::ERR_NAME_NOT_RESOLVED at https://shop.test/' }, ev());
  assert.equal(r.verdict.classification, 'environment');
  assert.equal(r.next, 'stop');
});

void test('navigation timeout is environment', () => {
  const r = classify({ ...base, error: 'TimeoutError: page.goto: Timeout 20000ms exceeded.' }, ev());
  assert.equal(r.verdict.classification, 'environment');
});

void test('503 on the document load is environment', () => {
  const r = classify(
    { ...base, error: "expect(locator).toBeVisible() failed\nLocator: getByRole('heading')" },
    ev([call('https://shop.test/', 503, 'document')]),
  );
  assert.equal(r.verdict.classification, 'environment');
});

void test('app 5xx is product; final only when the rerun is consistent', () => {
  const failed = { ...base, error: "expect(locator).toHaveText(expected) failed\nLocator: getByTestId('total')" };
  const net = [call('https://shop.test/', 200, 'document'), call('https://shop.test/api/cart', 500)];
  const once = classify(failed, ev(net));
  assert.equal(once.verdict.classification, 'product');
  assert.equal(once.next, 'crawler');
  const consistent = classify(failed, ev(net, { rerun: { passed: 0, failed: 3 } }));
  assert.equal(consistent.next, 'stop');
  assert.ok(consistent.verdict.confidence >= 0.8);
});

void test('third-party 5xx is ignored', () => {
  const r = classify(
    { ...base, error: "locator.click: Timeout 3000ms exceeded.\n  - waiting for getByRole('button', { name: 'Buy' })" },
    ev([call('https://shop.test/', 200, 'document'), call('https://tracker.example/collect', 500, 'fetch')]),
  );
  assert.equal(r.verdict.classification, 'undecided');
  assert.match(r.verdict.signature ?? '', /selector/);
  assert.equal(r.next, 'crawler');
});

void test('uncaught page error from the attachment is product', () => {
  const r = classify({ ...base, error: 'expect(received).toBe(expected)', pageErrorsText: 'pageerror: x is undefined' }, ev());
  assert.equal(r.verdict.classification, 'product');
});

void test('strict mode violation goes to the crawler as selector suspect', () => {
  const r = classify(
    { ...base, error: "Error: strict mode violation: getByRole('link', { name: 'Home' }) resolved to 2 elements" },
    ev(),
  );
  assert.equal(r.next, 'crawler');
  assert.match(r.verdict.root_cause, /selector/);
});

void test('import error is automation and final', () => {
  const r = classify({ ...base, error: "Error: Cannot find module '../pages/CartPage'" }, ev());
  assert.equal(r.verdict.classification, 'automation');
  assert.equal(r.next, 'stop');
});

void test('fixture error is automation', () => {
  const r = classify({ ...base, error: 'Error: Fixture "data" threw: Invalid environment' }, ev());
  assert.equal(r.verdict.classification, 'automation');
});

void test('value mismatch with all 2xx goes crawler then claude', () => {
  const r = classify(
    { ...base, error: 'Error: expect(received).toBe(expected)\nExpected: 3\nReceived: 2' },
    ev([call('https://shop.test/', 200, 'document'), call('https://shop.test/api/cart', 200)]),
  );
  assert.equal(r.verdict.classification, 'undecided');
  assert.equal(r.verdict.signature, 'assertion mismatch, all responses 2xx');
  assert.equal(r.next, 'crawler');
});

void test('429 is environment (rate limit)', () => {
  const r = classify({ ...base, error: 'Error: 429 Too Many Requests' }, ev());
  assert.equal(r.verdict.classification, 'environment');
});

void test('unknown error falls through to claude', () => {
  const r = classify({ ...base, error: 'Something odd happened' }, ev());
  assert.equal(r.next, 'claude');
});
