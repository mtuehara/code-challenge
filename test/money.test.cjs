const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toCents, fromCents } = require('../dist/ads/money');

test('converte reais para centavos e volta sem multiplicação em ponto flutuante', () => {
  assert.equal(toCents(800.25), 80025);
  assert.equal(toCents(800.2), 80020);
  assert.equal(toCents(800), 80000);
  assert.equal(toCents(0.01), 1);
  assert.equal(toCents(1), 100);
  assert.equal(fromCents(80025), 800.25);
  assert.equal(fromCents(1), 0.01);
  assert.throws(() => toCents(800.255));
  assert.throws(() => toCents(0));
  assert.throws(() => toCents(1e-7));
});
