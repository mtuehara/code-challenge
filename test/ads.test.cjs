const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { Client } = require('pg');
const { createApp } = require('../dist/app');

test('anúncio aprovado pode ser consultado após reiniciar a API', async () => {
  process.env.DATABASE_URL = 'postgres://anuncios:local_dev@127.0.0.1:5433/anuncios_test';
  const calls = [];
  const moderation = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls.push({ method: req.method, path: req.url, body: JSON.parse(body) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'approved' }));
  });
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  let app;
  let id;
  try {
    await db.connect();
    assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name, 'anuncios_test');
    await new Promise(resolve => moderation.listen(0, '127.0.0.1', resolve));
    process.env.MODERATION_URL = 'http://127.0.0.1:' + moderation.address().port;
    app = await createApp();
    await app.listen(0, '127.0.0.1');
    const input = {
      title: 'Bicicleta urbana', description: 'Bicicleta usada em bom estado.',
      price: 800.25, category: 'esportes', images: ['https://example.org/bicicleta.jpg'],
    };
    const response = await fetch(new URL('/ads', await app.getUrl()), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 201);
    const saved = await response.json();
    id = saved.id;
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.ok(Number.isFinite(Date.parse(saved.createdAt)));
    assert.deepEqual(saved, {
      ...input, id, createdAt: saved.createdAt, status: 'approved', rejectionReason: null,
    });
    assert.equal(response.headers.get('location'), '/ads/' + id);
    const { images, ...moderationInput } = input;
    assert.deepEqual(calls, [{ method: 'POST', path: '/v1/moderation/check', body: moderationInput }]);
    await app.close();
    app = await createApp();
    await app.listen(0, '127.0.0.1');
    const detail = await fetch(new URL(response.headers.get('location'), await app.getUrl()));
    assert.equal(detail.status, 200);
    assert.deepEqual(await detail.json(), saved);
    assert.equal(calls.length, 1);
  } finally {
    await app?.close();
    moderation.closeAllConnections();
    await new Promise(resolve => moderation.close(resolve));
    if (id) await db.query('DELETE FROM advertisements WHERE id = $1', [id]);
    await db.end();
  }
});
