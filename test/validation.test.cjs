const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { Client } = require('pg');
const { createApp } = require('../dist/app');

const testDatabaseUrl = 'postgres://anuncios:local_dev@127.0.0.1:5433/anuncios_test';

const baseInput = {
  title: 'Bicicleta urbana',
  description: 'Bicicleta usada em bom estado.',
  price: 800.25,
  category: 'esportes',
  images: ['https://example.org/bicicleta.jpg'],
};

async function startApprovalServer(receivedRequests) {
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    receivedRequests.push({ method: req.method, path: req.url, body });
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
    res.end(JSON.stringify({ status: 'approved' }));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

test('POST /ads rejeita payload inválido com 400 sem chamar a moderação', async () => {
  const { title, ...withoutTitle } = baseInput;
  const { description, ...withoutDescription } = baseInput;
  const { images, ...withoutImages } = baseInput;

  const invalidCases = [
    ['title com 9 caracteres', { ...baseInput, title: '123456789' }, 'title'],
    ['title com 101 caracteres', { ...baseInput, title: 'x'.repeat(101) }, 'title'],
    ['title em branco', { ...baseInput, title: '   ' }, 'title'],
    ['title ausente', withoutTitle, 'title'],
    ['description em branco', { ...baseInput, description: '   ' }, 'description'],
    ['description ausente', withoutDescription, 'description'],
    ['price zero', { ...baseInput, price: 0 }, 'price'],
    ['price negativo', { ...baseInput, price: -1 }, 'price'],
    ['price como texto', { ...baseInput, price: '800.25' }, 'price'],
    ['price com 3 casas', { ...baseInput, price: 800.255 }, 'price'],
    ['images vazio', { ...baseInput, images: [] }, 'images'],
    ['images como texto', { ...baseInput, images: 'https://example.org/a.jpg' }, 'images'],
    ['images com item vazio', { ...baseInput, images: [''] }, 'images'],
    ['images ausente', withoutImages, 'images'],
    ['category inexistente', { ...baseInput, category: 'inexistente' }, 'category'],
  ];

  const moderationRequests = [];
  const createdAdIds = [];
  const db = new Client({ connectionString: testDatabaseUrl });
  let moderation;
  let app;

  try {
    await db.connect();
    const database = await db.query('SELECT current_database() AS name');
    assert.equal(database.rows[0].name, 'anuncios_test');

    moderation = await startApprovalServer(moderationRequests);
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.MODERATION_URL = `http://127.0.0.1:${moderation.address().port}`;
    app = await createApp();
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();

    for (const [name, input, field] of invalidCases) {
      const response = await fetch(new URL('/ads', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (response.status === 201) createdAdIds.push(body.id);

      assert.equal(response.status, 400, `${name}: status HTTP`);
      assert.equal(body.statusCode, 400, `${name}: statusCode`);
      assert.equal(body.error, 'Bad Request', `${name}: error`);
      assert.equal(body.message, 'Dados inválidos.', `${name}: message`);
      assert.ok(Array.isArray(body.details), `${name}: details`);
      assert.ok(
        body.details.some(detail => detail.field === field || detail.field.startsWith(`${field}.`)),
        `${name}: campo ${field} nos detalhes`,
      );
    }

    assert.equal(moderationRequests.length, 0, 'moderação não deve ser chamada para payload inválido');
    const rows = await db.query('SELECT count(*)::int AS count FROM advertisements');
    assert.equal(rows.rows[0].count, 0, 'nenhuma linha deve ser gravada para payload inválido');

    const validInput = { ...baseInput, title: '  Bicicleta urbana  ' };
    const creation = await fetch(new URL('/ads', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validInput),
    });
    const createdAd = await creation.json();
    if (creation.status === 201) createdAdIds.push(createdAd.id);

    assert.equal(creation.status, 201);
    assert.equal(createdAd.title, 'Bicicleta urbana');
    assert.equal(createdAd.price, 800.25);
    assert.equal(moderationRequests.length, 1);
    assert.equal(JSON.parse(moderationRequests[0].body).title, 'Bicicleta urbana');

    const persisted = await db.query('SELECT title FROM advertisements WHERE id = $1', [createdAd.id]);
    assert.equal(persisted.rows[0].title, 'Bicicleta urbana');

    for (const boundaryTitle of ['1234567890', 'x'.repeat(100)]) {
      const boundary = await fetch(new URL('/ads', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...baseInput, title: boundaryTitle }),
      });
      const boundaryAd = await boundary.json();
      if (boundary.status === 201) createdAdIds.push(boundaryAd.id);
      assert.equal(boundary.status, 201, `title com ${boundaryTitle.length} caracteres deve ser aceito`);
      assert.equal(boundaryAd.title, boundaryTitle);
    }
    assert.equal(moderationRequests.length, 3);
  } finally {
    if (createdAdIds.length > 0) {
      await db.query('DELETE FROM advertisements WHERE id = ANY($1::uuid[])', [createdAdIds]);
    }
    await app?.close();
    if (moderation) await new Promise(resolve => moderation.close(resolve));
    await db.end();
  }
});
