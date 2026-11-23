const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { Client } = require('pg');
const { createApp } = require('../dist/app');

process.env.DATABASE_URL = 'postgres://anuncios:local_dev@127.0.0.1:5433/anuncios_test';
const db = new Client({ connectionString: process.env.DATABASE_URL });
const ad = { title: 'Bicicleta urbana', description: 'Quadro azul', category: 'esportes', price: 800.25, images: ['https://example.org/bike.jpg'] };
let app, base, server, respond, calls;
async function start() {
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
}
function post(body) {
  return fetch(base + '/ads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
before(async () => {
  await db.connect();
  server = createServer(async (req, res) => {
    let data = '';
    for await (const chunk of req) data += chunk;
    calls.push({ path: req.url, method: req.method, body: JSON.parse(data) });
    respond(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.MODERATION_URL = 'http://127.0.0.1:' + server.address().port;
  await start();
});
beforeEach(async () => {
  calls = [];
  respond = res => res.end(JSON.stringify({ status: 'approved' }));
  if ((await db.query("SELECT to_regclass('ads') AS tbl")).rows[0].tbl) await db.query('DELETE FROM ads');
});
after(async () => {
  await app?.close();
  server?.closeAllConnections();
  server?.close();
  await db.end();
});
test('aprovado continua consultável depois de reiniciar a API', async () => {
  const res = await post(ad);
  assert.equal(res.status, 201);
  const saved = await res.json();
  assert.deepEqual(calls, [{ method: 'POST', path: '/v1/moderation/check', body: { title: ad.title, description: ad.description, category: ad.category, price: ad.price } }]);
  assert.deepEqual(saved, { ...ad, id: saved.id, createdAt: saved.createdAt, status: 'approved', rejectionReason: null });
  assert.ok(Date.parse(saved.createdAt));
  assert.equal(res.headers.get('location'), '/ads/' + saved.id);
  await app.close();
  await start();
  const detail = await fetch(base + res.headers.get('location'));
  assert.equal(detail.status, 200);
  assert.deepEqual(await detail.json(), saved);
});
